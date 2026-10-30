import { z } from "zod";
import { ID_PATTERN, newId, store } from "./kv";
import { FlightQuoteSchema, ItineraryInputSchema, StayQuoteSchema, TripInputSchema } from "./validate";

// Saved trips (snapshots behind a share link) and group check-ins.
// Both need storage that outlives one request; callers check `storageAvailable` first.

const DAY = 86_400;
const TRIP_TTL = 90 * DAY;
const GROUP_TTL = 30 * DAY;

export const SavedTripSchema = z.object({
  input: TripInputSchema,
  destinationId: z.string().max(40),
  flight: FlightQuoteSchema,
  stay: StayQuoteSchema,
  itinerary: ItineraryInputSchema,
  meta: z.object({ ai: z.boolean(), premium: z.boolean().optional(), aiAvailable: z.boolean() }),
});
export type SavedTrip = z.infer<typeof SavedTripSchema>;

/** Saves a snapshot and returns its ID. Snapshots never change: a newer version of a plan gets a new ID. */
export async function saveTrip(trip: SavedTrip) {
  const id = newId();
  await store.set(`trip:${id}`, JSON.stringify({ ...trip, savedAt: new Date().toISOString() }), TRIP_TTL);
  return id;
}

export async function loadTrip(id: string): Promise<(SavedTrip & { savedAt: string }) | null> {
  if (!ID_PATTERN.test(id)) return null;
  const raw = await store.get(`trip:${id}`);
  return raw ? JSON.parse(raw) : null;
}

// ---------------------------------------------------------------------------
// Group check-in: each friend adds what they can spend, privately. ghoomo only ever shows the
// lowest amount, and only once enough people have added theirs that it can't be pinned on anyone.

export const GroupSizeSchema = z.number().int().min(2).max(12);
export const LimitSchema = z.number().int().min(1000).max(1_000_000);

export interface GroupStatus {
  size: number;
  count: number;
  /** The lowest limit, once enough people are in. */
  lowest: number | null;
  /** How many need to be in before the lowest is shown. */
  revealAt: number;
  /** What this browser added, so they can see and change it. Nobody else's is ever returned. */
  mine: number | null;
}

/** Shown once at least 3 people are in (or everyone, for groups of 2–3). */
const revealAt = (size: number) => Math.min(size, 3);

export async function createGroup(size: number) {
  const id = newId();
  await store.set(`group:${id}`, JSON.stringify({ size, createdAt: new Date().toISOString() }), GROUP_TTL);
  return id;
}

export async function groupStatus(id: string, browser: string): Promise<GroupStatus | null> {
  if (!ID_PATTERN.test(id)) return null;
  const raw = await store.get(`group:${id}`);
  if (!raw) return null;
  const { size } = JSON.parse(raw) as { size: number };
  const limits = await store.hgetall(`group:${id}:limits`);
  const values = Object.values(limits).map(Number);
  const count = values.length;
  const reveal = revealAt(size);
  return {
    size,
    count,
    lowest: count >= reveal ? Math.min(...values) : null,
    revealAt: reveal,
    mine: limits[browser] ? Number(limits[browser]) : null,
  };
}

/** Adds or replaces this browser's limit. Refuses new people once the group is full. */
export async function addLimit(id: string, browser: string, limit: number): Promise<"ok" | "missing" | "full"> {
  const status = await groupStatus(id, browser);
  if (!status) return "missing";
  if (status.mine === null && status.count >= status.size) return "full";
  await store.hset(`group:${id}:limits`, browser, String(limit), GROUP_TTL);
  return "ok";
}
