import { NextResponse } from "next/server";
import { findDestination } from "@/data/destinations";
import { storageAvailable } from "@/lib/kv";
import { identify, rateLimit, withVisitor } from "@/lib/limits";
import { SavedTripSchema, saveTrip } from "@/lib/shared";

const MAX_BODY_CHARS = 80_000;

/** Saves a plan so it can be opened again from a link. */
export async function POST(req: Request) {
  if (!storageAvailable) return NextResponse.json({ error: "Saving trips isn't switched on yet." }, { status: 503 });
  const visitor = identify(req);
  const reply = (payload: unknown, init?: ResponseInit) => withVisitor(NextResponse.json(payload, init), visitor);
  if (!(await rateLimit(visitor, "save", 20, 200))) return reply({ error: "Too many saves in a minute. Try again shortly." }, { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return reply({ error: "That plan is too large to save." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return reply({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = SavedTripSchema.safeParse(json);
  if (!parsed.success || !findDestination(parsed.data.destinationId)) return reply({ error: "This plan couldn't be saved." }, { status: 400 });
  const id = await saveTrip(parsed.data);
  return reply({ id });
}
