import { findOrigin } from "@/data/airports";
import type { Destination, FlightQuote, Tier, TravelMode, TripInput } from "./types";

// How a group gets from their city to a destination and back, and roughly what it costs.
//
// There's no open API for Indian train or bus fares, so these are estimates from distance:
// straight-line distance × 1.3 for the real route, then typical per-km fares by class.
// Rough 2026 figures; they're labelled "estimate" everywhere they show.

const ROUTE_FACTOR = 1.3;
const SPEED_KMH: Record<"train" | "bus", number> = { train: 55, bus: 48 };

// One-way fare per km, per person, by travel style.
// Train: sleeper / 3AC / 2AC. Bus: non-AC sleeper / AC sleeper / premium AC.
const PER_KM: Record<"train" | "bus", Record<Tier, number>> = {
  train: { budget: 0.75, comfort: 1.35, luxury: 1.95 },
  bus: { budget: 1.6, comfort: 2.4, luxury: 3.2 },
};
const MIN_FARE: Record<"train" | "bus", number> = { train: 100, bus: 150 };

// Longest one-way trip over land each style will put up with, in hours, before flying instead.
const MAX_GROUND_HOURS: Record<Tier, number> = { budget: 26, comfort: 14, luxury: 6 };

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const round = (n: number, step = 100) => Math.round(n / step) * step;

/**
 * Domestic return airfare estimate from distance: a base plus a per-km part. Some routes
 * (Leh, small airports) cost more than distance suggests, so the place's typical fare sets a floor.
 */
function domesticFlight(d: Destination, km: number, tier: Tier) {
  const oneWay = 2200 + 1.6 * km;
  const byDistance = Math.max(oneWay * 2, d.flightEstimate * 0.75);
  return round(byDistance * { budget: 1, comfort: 1.15, luxury: 2.2 }[tier]);
}

/** Abroad: the destination's typical fare, nudged up or down by how far this city is compared with Delhi. */
function internationalFlight(d: Destination, km: number, kmFromDelhi: number, tier: Tier) {
  const ratio = Math.min(Math.max(km / Math.max(kmFromDelhi, 1), 0.7), 1.6);
  return round(d.flightEstimate * Math.sqrt(ratio) * { budget: 1, comfort: 1.1, luxury: 2.5 }[tier]);
}

function describe(mode: "train" | "bus", hours: number) {
  const noun = mode === "train" ? "train" : "bus";
  if (hours < 1.5) return `Short ${noun}, about an hour`;
  if (hours < 7) return `${noun[0].toUpperCase()}${noun.slice(1)}, about ${Math.round(hours)} h`;
  if (hours <= 14) return `Overnight ${noun}, about ${Math.round(hours)} h`;
  return `${noun[0].toUpperCase()}${noun.slice(1)}, about ${Math.round(hours)} h`;
}

function trainLink() {
  return "https://www.irctc.co.in/nget/train-search";
}

function busLink(fromSlug: string | undefined, toSlug: string | undefined) {
  if (!fromSlug || !toSlug) return "https://www.redbus.in/";
  return `https://www.redbus.in/bus-tickets/${fromSlug}-to-${toSlug}`;
}

export interface TravelPlan extends FlightQuote {
  mode: TravelMode;
  label: string;
}

/**
 * Picks how to get there (train, bus or flight) and estimates the return fare per person.
 * Flights get a live fare later, in providers/flights.ts, when a fare API key is set.
 */
export function planTravel(input: TripInput, d: Destination, flightUrl: string): TravelPlan {
  const origin = findOrigin(input.origin);
  if (!origin) {
    return { mode: "flight", label: "Flight", price: d.flightEstimate, source: "estimate", bookingUrl: flightUrl };
  }
  const km = distanceKm(origin, d);

  if (km < 25) {
    return { mode: "none", label: "You're already there", price: 0, hours: 0, source: "estimate", bookingUrl: flightUrl };
  }

  if (d.ground && !d.international) {
    const g = d.ground;
    const routeKm = km * ROUTE_FACTOR;
    const hours = routeKm / SPEED_KMH[g.mode];
    // Long journeys eat into short trips: only go overland if it leaves most of the trip for being there.
    // Up to 3 days: an overnight at most. 4–5 days: up to ~16 h. Longer trips: whatever the style allows.
    const fitsTrip = hours <= 12 || (input.days >= 4 && hours <= 16) || input.days >= 6;
    if (hours <= MAX_GROUND_HOURS[input.tier] && fitsTrip) {
      const oneWay = Math.max(routeKm * PER_KM[g.mode][input.tier], MIN_FARE[g.mode]);
      return {
        mode: g.mode,
        label: describe(g.mode, hours),
        hours: Math.round(hours),
        price: round(oneWay * 2),
        source: "estimate",
        bookingUrl: g.mode === "train" ? trainLink() : busLink(origin.busSlug, g.busSlug),
      };
    }
  }

  const delhi = findOrigin("DEL")!;
  const price = d.international ? internationalFlight(d, km, distanceKm(delhi, d), input.tier) : domesticFlight(d, km, input.tier);
  return {
    mode: "flight",
    label: d.arrivalNote ? "Flight, then onward" : "Flight",
    hours: Math.round(km / 700 + 2),
    price,
    source: "estimate",
    bookingUrl: flightUrl,
  };
}

/**
 * When a recent fare was seen for a different day than the trip starts (the fare API falls back to
 * the cheapest fare that month), say which day, so the price isn't mistaken for theirs.
 */
export function fareDateNote(q: FlightQuote, startDate: string) {
  if (q.source !== "live" || !q.departAt) return null;
  const seen = new Date(q.departAt);
  const wanted = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(seen.getTime()) || Math.abs(seen.getTime() - wanted.getTime()) <= 1.5 * 86_400_000) return null;
  return `Fare seen for a ${seen.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} departure, not your date.`;
}

/** How a saved quote should be described, including ones made before trains and buses existed. */
export const travelMode = (q: FlightQuote): TravelMode => q.mode ?? "flight";
