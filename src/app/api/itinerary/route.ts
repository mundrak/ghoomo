import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findDestination } from "@/data/destinations";
import { aiEnabled, generateItinerary, ItinerarySchema, templateItinerary } from "@/lib/itinerary";
import { allowance, cacheGet, cacheSet, planCacheKey, recordUse, visitorId, type Allowance } from "@/lib/limits";
import { quoteFlight } from "@/lib/providers/flights";
import { quoteStay } from "@/lib/providers/stays";
import type { FlightQuote, StayQuote } from "@/lib/types";
import { MAX_CHANGE_CHARS, TripInputSchema } from "@/lib/validate";

export const maxDuration = 300;

const BodySchema = z.object({
  input: TripInputSchema,
  destinationId: z.string().max(40),
  // Present when refining: reuse the quotes and current plan instead of re-fetching.
  flight: z.custom<FlightQuote>().optional(),
  stay: z.custom<StayQuote>().optional(),
  itinerary: ItinerarySchema.optional(),
  change: z.string().trim().min(1).max(MAX_CHANGE_CHARS).optional(),
});

const usage = (a: Pick<Allowance, "plansLeft" | "editsLeft">) => ({ plansLeft: a.plansLeft, editsLeft: a.editsLeft });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 60_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Some trip details look wrong. Please check the form." }, { status: 400 });
  const body = parsed.data;

  const destination = findDestination(body.destinationId);
  if (!destination) return NextResponse.json({ error: "Unknown destination" }, { status: 400 });

  const [flight, stay] = await Promise.all([
    body.flight ?? quoteFlight(body.input, destination),
    body.stay ?? quoteStay(body.input, destination),
  ]);
  const ctx = { input: body.input, destination, flight, stay };
  const isEdit = Boolean(body.change && body.itinerary);

  if (!aiEnabled()) {
    if (isEdit) return NextResponse.json({ error: "Editing by chat isn't switched on yet." }, { status: 400 });
    return NextResponse.json({ itinerary: templateItinerary(ctx), flight, stay, ai: false, aiAvailable: false });
  }

  const visitor = visitorId(req);
  const cacheKey = planCacheKey(body.input, destination.id);

  // Someone already asked for this exact trip: serve it for free.
  if (!isEdit) {
    const cached = await cacheGet<z.infer<typeof ItinerarySchema>>(cacheKey);
    if (cached) {
      const left = await allowance(visitor, "plan");
      return NextResponse.json({ itinerary: cached, flight, stay, ai: true, aiAvailable: true, ...usage(left) });
    }
  }

  const left = await allowance(visitor, isEdit ? "edit" : "plan");
  if (!left.allowed) {
    if (isEdit) return NextResponse.json({ error: left.reason, ...usage(left) }, { status: 429 });
    return NextResponse.json({
      itinerary: templateItinerary(ctx),
      flight,
      stay,
      ai: false,
      aiAvailable: true,
      notice: left.reason,
      ...usage(left),
    });
  }

  try {
    const { itinerary, costUsd } = await generateItinerary(ctx, body.itinerary, body.change);
    await recordUse(visitor, isEdit ? "edit" : "plan", costUsd);
    if (!isEdit) await cacheSet(cacheKey, itinerary);
    const after = isEdit ? { ...left, editsLeft: left.editsLeft - 1 } : { ...left, plansLeft: left.plansLeft - 1 };
    return NextResponse.json({ itinerary, flight, stay, ai: true, aiAvailable: true, ...usage(after) });
  } catch (err) {
    console.error("[ai] call failed", err);
    // A failed plan still gets a usable starter plan; a failed edit keeps the current one.
    if (!isEdit) {
      return NextResponse.json({
        itinerary: templateItinerary(ctx),
        flight,
        stay,
        ai: false,
        aiAvailable: true,
        notice: "Our AI planner couldn't be reached just now, so here's a starter plan. Try again in a few minutes.",
        ...usage(left),
      });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The planner is busy. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Planner error (${err.status}).` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
