import { skyscannerUrl, tripDates } from "../links";
import { planTravel } from "../travel";
import type { Destination, FlightQuote, TripInput } from "../types";

// First decides how to get there (train, bus or flight; see lib/travel.ts). For flights,
// recent fares come from the Travelpayouts (Aviasales) Data API: free with a Travelpayouts
// affiliate account, returns recently seen fares in INR and a bookable link. Without a
// token, or for trains and buses, the estimate from lib/travel.ts stands.

interface TravelpayoutsFare {
  price: number;
  airline: string;
  departure_at: string;
  return_at?: string;
  transfers: number;
  link: string;
}

export async function quoteTravel(input: TripInput, d: Destination): Promise<FlightQuote> {
  const fallback = planTravel(input, d, skyscannerUrl(input, d));
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (fallback.mode !== "flight" || !token || input.origin === d.airport) return fallback;

  const { checkin, checkout } = tripDates(input);
  const params = new URLSearchParams({
    origin: input.origin,
    destination: d.airport,
    departure_at: checkin.slice(0, 7), // whole month: cached data is sparse for exact days
    return_at: checkout.slice(0, 7),
    one_way: "false",
    currency: "inr",
    sorting: "price",
    limit: "30",
    token,
  });

  try {
    const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as { success: boolean; data: TravelpayoutsFare[] };
    if (!body.success || body.data.length === 0) return fallback;

    // Prefer a fare departing close to the chosen date over the absolute cheapest in the month.
    const target = Date.parse(checkin);
    const nearby = body.data.filter((f) => Math.abs(Date.parse(f.departure_at) - target) <= 3 * 86400_000);
    const fare = (nearby.length ? nearby : body.data)[0];

    const marker = process.env.TRAVELPAYOUTS_MARKER;
    return {
      ...fallback,
      price: fare.price,
      source: "live",
      airline: fare.airline,
      departAt: fare.departure_at,
      returnAt: fare.return_at,
      transfers: fare.transfers,
      bookingUrl: `https://www.aviasales.com${fare.link}${marker ? `&marker=${marker}` : ""}`,
    };
  } catch {
    return fallback;
  }
}
