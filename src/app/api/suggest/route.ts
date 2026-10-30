import { NextResponse } from "next/server";
import { DESTINATIONS } from "@/data/destinations";
import { estimateCost, scoreDestination } from "@/lib/budget";
import { identify, LIMITS, rateLimit, withVisitor } from "@/lib/limits";
import { skyscannerUrl } from "@/lib/links";
import { planTravel } from "@/lib/travel";
import { quoteTravel } from "@/lib/providers/flights";
import type { Suggestion } from "@/lib/types";
import { TripInputSchema } from "@/lib/validate";

// Live flight fares are only fetched for the best matches, to keep calls to the fare provider down.
// Trains and buses use estimates (see lib/travel.ts), so they need no lookup.
const LIVE_FARES_FOR = 10;

export async function POST(req: Request) {
  const visitor = identify(req);
  if (!(await rateLimit(visitor, "board", LIMITS.boardPerMinuteBrowser, LIMITS.boardPerMinuteNetwork))) {
    return withVisitor(NextResponse.json({ error: "That's a lot of changes in a minute. Give it a moment, then try again." }, { status: 429 }), visitor);
  }
  const parsed = TripInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Some trip details look wrong. Please check the form." }, { status: 400 });
  const input = parsed.data;

  const candidates = DESTINATIONS.filter((d) =>
    input.scope === "india" ? !d.international : input.scope === "abroad" ? d.international : true,
  );

  // Rank everything on estimates first, then fetch live fares for the shortlist only.
  const rough = candidates
    .map((d) => {
      const flight = planTravel(input, d, skyscannerUrl(input, d));
      const cost = estimateCost(d, input, flight);
      return { d, flight, cost, ...scoreDestination(d, input, cost) };
    })
    .sort((x, y) => y.fitScore - x.fitScore);

  const suggestions: Suggestion[] = await Promise.all(
    rough.map(async (r, i) => {
      if (i >= LIVE_FARES_FOR || r.flight.mode !== "flight") {
        const { d, ...rest } = r;
        return { destination: d, ...rest };
      }
      const flight = await quoteTravel(input, r.d);
      const cost = estimateCost(r.d, input, flight);
      return { destination: r.d, flight, cost, ...scoreDestination(r.d, input, cost) };
    }),
  );

  suggestions.sort((x, y) => y.fitScore - x.fitScore);
  return withVisitor(NextResponse.json({ suggestions }), visitor);
}
