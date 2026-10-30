import { createHash } from "node:crypto";
import type { TripInput } from "./types";

// Cost controls for AI calls: per-visitor daily allowances, a global daily
// spend cap in USD, and a cache so identical trip requests are only paid for once.
//
// Counters live in Redis (Upstash, free tier, via its REST API) when configured.
// Without Redis they fall back to process memory, which on serverless hosting
// resets whenever an instance is recycled. Fine for local dev, not for production.

const num = (v: string | undefined, fallback: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : fallback);

export const LIMITS = {
  plansPerVisitor: num(process.env.AI_PLANS_PER_VISITOR, 3),
  editsPerVisitor: num(process.env.AI_EDITS_PER_VISITOR, 10),
  dailyBudgetUsd: num(process.env.AI_DAILY_BUDGET_USD, 2),
};

const DAY_SECONDS = 86_400;
const CACHE_SECONDS = 7 * DAY_SECONDS;

// ---------------------------------------------------------------------------
// Storage

interface Store {
  get(key: string): Promise<string | null>;
  incrBy(key: string, by: number, ttlSeconds: number): Promise<number>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

function redisStore(url: string, token: string): Store {
  const pipeline = async (commands: (string | number)[][]) => {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis error ${res.status}`);
    return ((await res.json()) as { result: unknown }[]).map((r) => r.result);
  };
  return {
    get: async (key) => ((await pipeline([["GET", key]]))[0] as string | null) ?? null,
    incrBy: async (key, by, ttl) => Number((await pipeline([["INCRBY", key, by], ["EXPIRE", key, ttl]]))[0]),
    set: async (key, value, ttl) => void (await pipeline([["SET", key, value, "EX", ttl]])),
  };
}

function memoryStore(): Store {
  const data = new Map<string, { value: string; expires: number }>();
  const read = (key: string) => {
    const hit = data.get(key);
    if (hit && hit.expires < Date.now()) data.delete(key);
    return data.get(key)?.value ?? null;
  };
  return {
    get: async (key) => read(key),
    incrBy: async (key, by, ttl) => {
      const value = Number(read(key) ?? 0) + by;
      data.set(key, { value: String(value), expires: Date.now() + ttl * 1000 });
      return value;
    },
    set: async (key, value, ttl) => void data.set(key, { value, expires: Date.now() + ttl * 1000 }),
  };
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const store: Store = redisUrl && redisToken ? redisStore(redisUrl, redisToken) : memoryStore();

// ---------------------------------------------------------------------------
// Visitors and allowances

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const today = () => new Date().toISOString().slice(0, 10);

/** Hashed IP address, so raw IPs are never stored. */
export function visitorId(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return sha(`ghoomo:${ip}`);
}

export type AiKind = "plan" | "edit";

export interface Allowance {
  allowed: boolean;
  /** Why it isn't allowed, in words for the traveller. */
  reason?: string;
  plansLeft: number;
  editsLeft: number;
}

const keys = (visitor: string) => ({
  plans: `use:${today()}:${visitor}:plan`,
  edits: `use:${today()}:${visitor}:edit`,
  spend: `spend:${today()}`, // micro-dollars
});

export async function allowance(visitor: string, kind: AiKind): Promise<Allowance> {
  const k = keys(visitor);
  const [plans, edits, spend] = await Promise.all([store.get(k.plans), store.get(k.edits), store.get(k.spend)]);
  const plansLeft = Math.max(LIMITS.plansPerVisitor - Number(plans ?? 0), 0);
  const editsLeft = Math.max(LIMITS.editsPerVisitor - Number(edits ?? 0), 0);
  const base = { plansLeft, editsLeft };

  if (Number(spend ?? 0) / 1_000_000 >= LIMITS.dailyBudgetUsd) {
    return { ...base, allowed: false, reason: "Our AI planner is resting for today because it's been very popular. Here's a starter plan instead. Try AI again tomorrow!" };
  }
  if (kind === "plan" && plansLeft === 0) {
    return { ...base, allowed: false, reason: `You've used your ${LIMITS.plansPerVisitor} free AI plans for today, so here's a starter plan. You get more tomorrow.` };
  }
  if (kind === "edit" && editsLeft === 0) {
    return { ...base, allowed: false, reason: `You've used your ${LIMITS.editsPerVisitor} free AI edits for today. You get more tomorrow.` };
  }
  return { ...base, allowed: true };
}

export async function recordUse(visitor: string, kind: AiKind, costUsd: number) {
  const k = keys(visitor);
  await Promise.all([
    store.incrBy(kind === "plan" ? k.plans : k.edits, 1, 2 * DAY_SECONDS),
    store.incrBy(k.spend, Math.ceil(costUsd * 1_000_000), 2 * DAY_SECONDS),
  ]);
}

// ---------------------------------------------------------------------------
// Itinerary cache

/** Trips that would get the same plan share a key: dates by month, budgets rounded to ₹1,000. */
export function planCacheKey(input: TripInput, destinationId: string) {
  const round = (n: number) => Math.round(n / 1000);
  return `plan:v1:${sha(
    JSON.stringify([
      destinationId,
      input.days,
      input.startDate.slice(0, 7),
      input.party,
      input.travellers,
      input.tier,
      input.stay,
      input.diet,
      [...input.interests].sort(),
      [...input.cuisines].sort(),
      Object.values(input.budget).map(round),
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

export async function cacheSet(key: string, value: unknown) {
  try {
    await store.set(key, JSON.stringify(value), CACHE_SECONDS);
  } catch {
    // A failed cache write only costs a future AI call.
  }
}
