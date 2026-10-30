import { NextResponse } from "next/server";
import { z } from "zod";
import { findDestination } from "@/data/destinations";
import { COMPARE_TRIPS } from "@/lib/compareTrips";
import { aiEnabled, COMPARE_MODELS, generateItinerary } from "@/lib/itinerary";
import { addSpend } from "@/lib/limits";
import { quoteTravel } from "@/lib/providers/flights";
import { quoteStay } from "@/lib/providers/stays";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const Body = z.object({ key: z.string().max(200), trip: z.number().int().min(0), model: z.string().max(60) });

/**
 * Plans one of the fixed comparison trips with one model, for the /compare page.
 * Locked with STATS_KEY. Spend counts toward the daily AI cap.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const key = process.env.STATS_KEY;
  if (!parsed.success || !key || parsed.data.key !== key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't switched on: ANTHROPIC_API_KEY isn't set." }, { status: 503 });
  const { trip, model } = parsed.data;
  const t = COMPARE_TRIPS[trip];
  if (!t || !COMPARE_MODELS.includes(model)) return NextResponse.json({ error: "Unknown trip or model" }, { status: 400 });

  const destination = findDestination(t.destinationId)!;
  const [flight, stay] = await Promise.all([quoteTravel(t.input, destination), quoteStay(t.input, destination)]);
  try {
    const result = await generateItinerary({ input: t.input, destination, flight, stay }, undefined, undefined, model);
    await addSpend(result.costUsd).catch(() => {});
    return NextResponse.json({ ...result, flight, stay, input: t.input });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "The model call failed" }, { status: 502 });
  }
}
