import { stayPerPersonNight } from "../budget";
import { stayUrl, tripDates } from "../links";
import type { Destination, StayQuote, TripInput } from "../types";

// Live hotel rates come from LiteAPI (bookable inventory, free sandbox key at
// liteapi.travel). Hostels and Airbnbs have no open API, so for those we use
// estimates and send the user to Hostelworld / Airbnb with the search filled in.

interface LiteRate {
  name: string;
  retailRate: { total: { amount: number; currency: string }[] };
}
interface LiteHotelRates {
  hotelId: string;
  roomTypes: { rates: LiteRate[] }[];
}
interface LiteHotel {
  id: string;
  name: string;
}

export async function quoteStay(input: TripInput, d: Destination): Promise<StayQuote> {
  const nightly = stayPerPersonNight(d, input);
  const fallback: StayQuote = { perPersonNight: nightly, source: "estimate", bookingUrl: stayUrl(input, d) };
  const key = process.env.LITEAPI_KEY;
  if (!key || input.stay !== "hotel") return fallback;

  const { checkin, checkout } = tripDates(input);
  const nights = Math.max(input.days - 1, 1);
  const share = Math.min(Math.max(input.roomShare ?? 2, 1), 4);
  const rooms = Math.ceil(input.travellers / share);
  const occupancies = Array.from({ length: rooms }, (_, i) => ({
    adults: i === rooms - 1 && input.travellers % share !== 0 ? input.travellers % share : share,
  }));

  try {
    const res = await fetch("https://api.liteapi.travel/v3.0/hotels/rates", {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cityName: d.hotelCity,
        countryCode: d.countryCode,
        checkin,
        checkout,
        currency: "INR",
        guestNationality: "IN",
        occupancies,
        limit: 40,
      }),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as { data?: LiteHotelRates[]; hotels?: LiteHotel[] };
    const names = new Map((body.hotels ?? []).map((h) => [h.id, h.name]));

    // Cheapest rate per hotel, converted to per person per night.
    const options = (body.data ?? [])
      .map((h) => {
        const rate = h.roomTypes.flatMap((rt) => rt.rates)[0];
        const total = rate?.retailRate.total[0]?.amount;
        if (!total) return null;
        return {
          name: names.get(h.hotelId) ?? "Hotel",
          roomName: rate.name,
          perPersonNight: Math.round(total / nights / input.travellers),
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .sort((x, y) => x.perPersonNight - y.perPersonNight);
    if (options.length === 0) return fallback;

    // Pick the hotel closest to the user's per-night stay budget without going over.
    const budgetNight = input.budget.stay / nights;
    const pick = [...options].reverse().find((o) => o.perPersonNight <= budgetNight) ?? options[0];
    return {
      perPersonNight: pick.perPersonNight,
      source: "live",
      name: pick.name,
      roomName: pick.roomName,
      bookingUrl: stayUrl(input, d),
      options: options.slice(0, 5).map(({ name, perPersonNight }) => ({ name, perPersonNight })),
    };
  } catch {
    return fallback;
  }
}
