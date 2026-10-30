import { NextResponse } from "next/server";
import { DESTINATIONS } from "@/data/destinations";
import { estimateCost, scoreDestination } from "@/lib/budget";
import { quoteFlight } from "@/lib/providers/flights";
import type { Suggestion, TripInput } from "@/lib/types";

export async function POST(req: Request) {
  const input = (await req.json()) as TripInput;

  const candidates = DESTINATIONS.filter((d) =>
    input.scope === "india" ? !d.international : input.scope === "abroad" ? d.international : true,
  );

  // Rank on estimates first, then fetch live fares only for the shortlist.
  const rough = candidates
    .map((d) => {
      const cost = estimateCost(d, input, { price: d.flightEstimate, source: "estimate", bookingUrl: "" });
      return { d, ...scoreDestination(d, input, cost) };
    })
    .sort((x, y) => y.fitScore - x.fitScore)
    .slice(0, 8);

  const suggestions: Suggestion[] = await Promise.all(
    rough.map(async ({ d }) => {
      const flight = await quoteFlight(input, d);
      const cost = estimateCost(d, input, flight);
      return { destination: d, flight, cost, ...scoreDestination(d, input, cost) };
    }),
  );

  suggestions.sort((x, y) => y.fitScore - x.fitScore);
  return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
}
