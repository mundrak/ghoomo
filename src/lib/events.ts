import { store } from "./kv";

// Anonymous usage counts: how many times each step happened per day. No IDs, no IPs, no trip
// details are stored with them, just a number per event per day. Enough to see the funnel
// (board → pass → plan → booking or share) and how plans are rated.

export const EVENTS = [
  "board_shown",
  "pass_opened",
  "plan_requested",
  "plan_shown",
  "book_travel",
  "book_stay",
  "share_whatsapp",
  "copy_link",
  "trip_link_opened",
  "group_started",
  "group_checked_in",
  "group_budget_used",
  "plan_useful",
  "plan_not_useful",
] as const;
export type EventName = (typeof EVENTS)[number];

export const FEEDBACK_REASONS = ["prices", "places", "pace", "food", "other"] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

const KEEP_SECONDS = 400 * 86_400;
const day = (offset = 0) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

export async function countEvent(name: EventName, reason?: FeedbackReason) {
  const key = reason ? `${name}:${reason}` : name;
  await store.incrBy(`ev:${day()}:${key}`, 1, KEEP_SECONDS);
}

/** Counts for the last `days` days, newest first, plus totals. */
export async function eventStats(days = 14) {
  const keys = [...EVENTS, ...FEEDBACK_REASONS.map((r) => `plan_not_useful:${r}`)];
  const rows = await Promise.all(
    Array.from({ length: days }, async (_, i) => {
      const date = day(i);
      const values = await Promise.all(keys.map(async (k) => Number((await store.get(`ev:${date}:${k}`)) ?? 0)));
      return { date, counts: Object.fromEntries(keys.map((k, j) => [k, values[j]]).filter(([, v]) => v)) as Record<string, number> };
    }),
  );
  const totals: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.counts)) totals[k] = (totals[k] ?? 0) + v;
  return { days, totals, byDay: rows };
}
