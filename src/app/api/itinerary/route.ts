import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { findDestination } from "@/data/destinations";
import { aiEnabled, generateItinerary, templateItinerary, type Itinerary } from "@/lib/itinerary";
import { quoteFlight } from "@/lib/providers/flights";
import { quoteStay } from "@/lib/providers/stays";
import type { FlightQuote, StayQuote, TripInput } from "@/lib/types";

export const maxDuration = 300;

interface Body {
  input: TripInput;
  destinationId: string;
  /** Present when refining: reuse the quotes and current plan instead of re-fetching. */
  flight?: FlightQuote;
  stay?: StayQuote;
  itinerary?: Itinerary;
  change?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const destination = findDestination(body.destinationId);
  if (!destination) return NextResponse.json({ error: "Unknown destination" }, { status: 400 });

  const [flight, stay] = await Promise.all([
    body.flight ?? quoteFlight(body.input, destination),
    body.stay ?? quoteStay(body.input, destination),
  ]);
  const ctx = { input: body.input, destination, flight, stay };

  if (!aiEnabled()) {
    if (body.change) {
      return NextResponse.json({ error: "Editing by chat needs ANTHROPIC_API_KEY to be set." }, { status: 400 });
    }
    return NextResponse.json({ itinerary: templateItinerary(ctx), flight, stay, ai: false });
  }

  try {
    const itinerary = await generateItinerary(ctx, body.itinerary, body.change);
    return NextResponse.json({ itinerary, flight, stay, ai: true });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The planner is busy. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Planner error (${err.status}).` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
