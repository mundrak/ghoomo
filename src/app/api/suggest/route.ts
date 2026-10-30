import { NextResponse } from "next/server";
import { DESTINATIONS } from "@/data/destinations";
import { estimateCost, scoreDestination } from "@/lib/budget";
import { identify, LIMITS, rateLimit, withVisitor } from "@/lib/limits";
import { skyscannerUrl } from "@/lib/links";
import { quoteFlight } from "@/lib/providers/flights";
import type { Suggestion } from "@/lib/types";
import { TripInputSchema } from "@/lib/validate";

// Live fares are only fetched for the best matches, to keep calls to the fare provider down.
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
      const flight = { price: input.origin === d.airport ? 0 : d.flightEstimate, source: "estimate" as const, bookingUrl: "" };
      const cost = estimateCost(d, input, flight);
      return { d, flight, cost, ...scoreDestination(d, input, cost) };
    })
    .sort((x, y) => y.fitScore - x.fitScore);

  const suggestions: Suggestion[] = await Promise.all(
    rough.map(async (r, i) => {
      if (i >= LIVE_FARES_FOR) {
        const { d, ...rest } = r;
        return { destination: d, ...rest, flight: { ...r.flight, bookingUrl: skyscannerUrl(input, d) } };
      }
      const flight = await quoteFlight(input, r.d);
      const cost = estimateCost(r.d, input, flight);
      return { destination: r.d, flight, cost, ...scoreDestination(r.d, input, cost) };
    }),
  );

  suggestions.sort((x, y) => y.fitScore - x.fitScore);
  return withVisitor(NextResponse.json({ suggestions }), visitor);
}
