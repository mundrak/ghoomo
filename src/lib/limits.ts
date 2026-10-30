import { createHash } from "node:crypto";
import { store } from "./kv";
import type { TripInput } from "./types";

// Cost controls for AI calls: per-visitor daily allowances, a global daily
// spend cap in USD, and a cache so identical trip requests are only paid for once.
//
// Counters live in Redis when configured, otherwise in process memory (see kv.ts).
// Memory resets whenever a serverless instance is recycled: fine for local dev, not production.

const num = (v: string | undefined, fallback: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : fallback);

export const LIMITS = {
  plansPerVisitor: num(process.env.AI_PLANS_PER_VISITOR, 3),
  editsPerVisitor: num(process.env.AI_EDITS_PER_VISITOR, 10),
  // Backstop per network. Set well above the per-browser limit, because a college hostel or a
  // mobile carrier can put many people behind one IP address.
  plansPerNetwork: num(process.env.AI_PLANS_PER_NETWORK, 30),
  editsPerNetwork: num(process.env.AI_EDITS_PER_NETWORK, 100),
  dailyBudgetUsd: num(process.env.AI_DAILY_BUDGET_USD, 2),
  // Part of the daily budget that can go on the premium model. Once it's spent, trips that
  // would get the premium model get the standard one instead.
  premiumDailyBudgetUsd: num(process.env.AI_PREMIUM_DAILY_BUDGET_USD, 1),
  // Destination board requests, per minute. Each one can look up several live fares.
  boardPerMinuteBrowser: num(process.env.BOARD_PER_MINUTE_BROWSER, 30),
  boardPerMinuteNetwork: num(process.env.BOARD_PER_MINUTE_NETWORK, 300),
};

const DAY_SECONDS = 86_400;
const CACHE_SECONDS = 7 * DAY_SECONDS;

// ---------------------------------------------------------------------------
// Visitors and allowances

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const today = () => new Date().toISOString().slice(0, 10);

export const VISITOR_COOKIE = "ghoomo_vid";
const COOKIE_ID = /^[0-9a-f-]{36}$/;

export interface Visitor {
  /** Anonymous ID kept in a cookie: one per browser. */
  browser: string;
  /** Hashed IP address (raw IPs are never stored): a backstop for people who clear cookies. */
  network: string;
  /** Set when this request had no valid cookie; the response should save it. */
  newCookie?: string;
}

/** Who is asking. Limits are per browser, with a looser per-network backstop. */
export function identify(req: Request): Visitor {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const network = sha(`ghoomo:ip:${ip}`);
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === VISITOR_COOKIE)?.[1];
  if (cookie && COOKIE_ID.test(cookie)) return { browser: sha(`ghoomo:id:${cookie}`), network };
  const fresh = crypto.randomUUID();
  return { browser: sha(`ghoomo:id:${fresh}`), network, newCookie: fresh };
}

/** Saves the visitor cookie on a response when the request didn't have one. */
export function withVisitor<T extends { cookies: { set: (name: string, value: string, options: object) => unknown } }>(res: T, v: Visitor): T {
  if (v.newCookie) {
    res.cookies.set(VISITOR_COOKIE, v.newCookie, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 365 * DAY_SECONDS });
  }
  return res;
}

/** Fixed-window rate limit. Returns true when the request is allowed. */
export async function rateLimit(v: Visitor, name: string, perBrowser: number, perNetwork: number, windowSeconds = 60) {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  try {
    const [b, n] = await Promise.all([
      store.incrBy(`rl:${name}:${bucket}:b:${v.browser}`, 1, windowSeconds * 2),
      store.incrBy(`rl:${name}:${bucket}:n:${v.network}`, 1, windowSeconds * 2),
    ]);
    return b <= perBrowser && n <= perNetwork;
  } catch {
    return true; // If the counter store is down, don't block people.
  }
}

export type AiKind = "plan" | "edit";

export interface Allowance {
  allowed: boolean;
  /** Why it isn't allowed, in words for the traveller. */
  reason?: string;
  plansLeft: number;
  editsLeft: number;
}

const keys = (v: Visitor) => ({
  plans: `use:${today()}:b:${v.browser}:plan`,
  edits: `use:${today()}:b:${v.browser}:edit`,
  netPlans: `use:${today()}:n:${v.network}:plan`,
  netEdits: `use:${today()}:n:${v.network}:edit`,
  spend: `spend:${today()}`, // micro-dollars
});

export async function allowance(v: Visitor, kind: AiKind): Promise<Allowance> {
  const k = keys(v);
  const [plans, edits, netPlans, netEdits, spend] = await Promise.all([
    store.get(k.plans),
    store.get(k.edits),
    store.get(k.netPlans),
    store.get(k.netEdits),
    store.get(k.spend),
  ]);
  const plansLeft = Math.max(LIMITS.plansPerVisitor - Number(plans ?? 0), 0);
  const editsLeft = Math.max(LIMITS.editsPerVisitor - Number(edits ?? 0), 0);
  const base = { plansLeft, editsLeft };

  if (Number(spend ?? 0) / 1_000_000 >= LIMITS.dailyBudgetUsd) {
    return { ...base, allowed: false, reason: "The AI planner has hit today's limit. Here's a starter plan instead. AI plans are back tomorrow." };
  }
  if (kind === "plan" && plansLeft === 0) {
    return { ...base, allowed: false, reason: `You've used your ${LIMITS.plansPerVisitor} free AI plans for today, so here's a starter plan. You get more tomorrow.` };
  }
  if (kind === "edit" && editsLeft === 0) {
    return { ...base, allowed: false, reason: `You've used your ${LIMITS.editsPerVisitor} free AI edits for today. You get more tomorrow.` };
  }
  if (kind === "plan" && Number(netPlans ?? 0) >= LIMITS.plansPerNetwork) {
    return { ...base, allowed: false, reason: "Lots of people on your network have used AI plans today, so here's a starter plan. Try again tomorrow." };
  }
  if (kind === "edit" && Number(netEdits ?? 0) >= LIMITS.editsPerNetwork) {
    return { ...base, allowed: false, reason: "Lots of people on your network have used AI edits today. Try again tomorrow." };
  }
  return { ...base, allowed: true };
}

const premiumKey = () => `spend:premium:${today()}`;

/** True while today's premium-model spend is under its cap. */
export async function premiumAvailable() {
  try {
    return Number((await store.get(premiumKey())) ?? 0) / 1_000_000 < LIMITS.premiumDailyBudgetUsd;
  } catch {
    return false;
  }
}

export async function addPremiumSpend(costUsd: number) {
  await store.incrBy(premiumKey(), Math.ceil(costUsd * 1_000_000), 2 * DAY_SECONDS);
}

/** Counts AI spend that isn't tied to a visitor (the model comparison page) toward the daily cap. */
export async function addSpend(costUsd: number) {
  await store.incrBy(`spend:${today()}`, Math.ceil(costUsd * 1_000_000), 2 * DAY_SECONDS);
}

export async function recordUse(v: Visitor, kind: AiKind, costUsd: number) {
  const k = keys(v);
  await Promise.all([
    store.incrBy(kind === "plan" ? k.plans : k.edits, 1, 2 * DAY_SECONDS),
    store.incrBy(kind === "plan" ? k.netPlans : k.netEdits, 1, 2 * DAY_SECONDS),
    store.incrBy(k.spend, Math.ceil(costUsd * 1_000_000), 2 * DAY_SECONDS),
  ]);
}

// ---------------------------------------------------------------------------
// Itinerary cache

/**
 * Trips that would get much the same plan share a key, so a plan is only paid for once.
 * Kept deliberately coarse (the old key matched almost nobody): month not date, group size in
 * bands, total budget to the nearest ₹2,500, and cuisines left out.
 */
export function planCacheKey(input: TripInput, destinationId: string) {
  const n = input.travellers;
  const groupBand = n === 1 ? "1" : n === 2 ? "2" : n <= 4 ? "3-4" : n <= 6 ? "5-6" : "7+";
  const total = Object.values(input.budget).reduce((s, x) => s + x, 0);
  return `plan:v3:${sha(
    JSON.stringify([
      destinationId,
      input.origin,
      input.days,
      input.startDate.slice(0, 7),
      groupBand,
      input.tier,
      input.stay,
      input.diet,
      [...input.interests].sort(),
      Math.round(total / 2500),
    ]),
  )}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, seconds = CACHE_SECONDS) {
  try {
    await store.set(key, JSON.stringify(value), seconds);
  } catch {
    // A failed cache write only costs a future AI call.
  }
}
