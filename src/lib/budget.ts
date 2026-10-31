import { findOrigin } from "@/data/airports";
import { distanceKm } from "./travel";
import { abroadNearnessPoints, nearness } from "./zones";
import type {
  Activity,
  CategoryBudget,
  CostBreakdown,
  Destination,
  FlightQuote,
  Suggestion,
  Tier,
  TripInput,
} from "./types";

export const CATEGORIES = ["flights", "stay", "food", "activities", "transport"] as const;

export const CATEGORY_LABELS: Record<keyof CategoryBudget, string> = {
  flights: "Getting there",
  stay: "Stay",
  food: "Food",
  activities: "Experiences",
  transport: "Local transport",
};

// Per-person defaults for each tier: getting there and back, plus per-day spend.
// Budget assumes a train or bus for most trips (a sleeper return is usually ₹1,500–4,000), with room for a cheap flight.
const TIER_PRESETS: Record<Tier, { flights: number; perDay: Omit<CategoryBudget, "flights"> }> = {
  budget: { flights: 5000, perDay: { stay: 900, food: 800, activities: 700, transport: 500 } },
  comfort: { flights: 14000, perDay: { stay: 2800, food: 1700, activities: 1500, transport: 1200 } },
  luxury: { flights: 35000, perDay: { stay: 9000, food: 4500, activities: 4000, transport: 3500 } },
};

// Return flights abroad cost far more than a train or a domestic hop (Delhi–Bangkok is usually
// ₹18,000–30,000), so trips abroad start with a bigger "getting there" share.
const ABROAD_TRAVEL: Record<Tier, number> = { budget: 18000, comfort: 28000, luxury: 60000 };

/** The default "getting there" amount for a tier, bigger when looking abroad. */
export const presetTravel = (tier: Tier, scope: TripInput["scope"] = "anywhere") =>
  scope === "abroad" ? ABROAD_TRAVEL[tier] : TIER_PRESETS[tier].flights;

export const TIER_INFO: Record<Tier, { label: string; blurb: string }> = {
  budget: { label: "Budget", blurb: "Sleeper trains and buses, hostels, street food, free sights" },
  comfort: { label: "Comfort", blurb: "AC trains or short flights, nice hotels or Airbnbs, a few splurges" },
  luxury: { label: "Luxury", blurb: "Flights, premium stays, fine dining, private tours" },
};

const roundTo = (n: number, step = 100) => Math.round(n / step) * step;

export function presetBudget(tier: Tier, days: number, scope: TripInput["scope"] = "anywhere"): CategoryBudget {
  const p = TIER_PRESETS[tier];
  const nights = Math.max(days - 1, 1);
  return {
    flights: presetTravel(tier, scope),
    stay: roundTo(p.perDay.stay * nights),
    food: roundTo(p.perDay.food * days),
    activities: roundTo(p.perDay.activities * days),
    transport: roundTo(p.perDay.transport * days),
  };
}

export const sumBudget = (b: CategoryBudget) => CATEGORIES.reduce((s, c) => s + b[c], 0);

/** Per-person spend per day (excluding flights) for a tier, for showing in the UI. */
export const tierPerDay = (tier: Tier) => Object.values(TIER_PRESETS[tier].perDay).reduce((s, x) => s + x, 0);

/** Resize a budget to a new total, keeping each category's share. */
export function scaleBudget(b: CategoryBudget, total: number): CategoryBudget {
  const current = sumBudget(b) || 1;
  const scaled = Object.fromEntries(CATEGORIES.map((c) => [c, roundTo((b[c] * total) / current)])) as CategoryBudget;
  scaled.stay += total - sumBudget(scaled); // put the rounding remainder into stay
  return scaled;
}

/** Per-person, per-night stay cost, accounting for how the group shares rooms. */
export function stayPerPersonNight(d: Destination, input: Pick<TripInput, "stay" | "tier" | "travellers" | "roomShare">) {
  const n = Math.max(input.travellers, 1);
  switch (input.stay) {
    case "hostel": {
      // Comfort/luxury hostel travellers usually book private rooms.
      const mult = { budget: 1, comfort: 1.8, luxury: 2.5 }[input.tier];
      return roundTo(d.stay.hostelBed * mult, 10);
    }
    case "hotel": {
      // An extra bed adds roughly 15% to the room price.
      const share = Math.min(Math.max(input.roomShare ?? 2, 1), 4);
      const rooms = Math.ceil(n / share);
      const perRoom = d.stay.hotelRoom[input.tier] * (1 + 0.15 * Math.max(share - 2, 0));
      return roundTo((perRoom * rooms) / n, 10);
    }
    case "airbnb": {
      // Listed prices are for a place that sleeps 4-6; smaller parties take a smaller place.
      const places = Math.ceil(n / 6);
      const sizeFactor = n <= 2 ? 0.6 : 1;
      return roundTo((d.stay.airbnbPlace[input.tier] * sizeFactor * places) / n, 10);
    }
  }
}

/** One activity per full day (arrival and departure days excluded), best interest matches first. */
export function pickActivities(d: Destination, input: Pick<TripInput, "interests" | "days">): Activity[] {
  const scored = d.activities
    .map((act) => ({ act, score: act.tags.filter((t) => input.interests.includes(t)).length }))
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, Math.max(1, input.days - 2)).map((s) => s.act);
}

export function estimateCost(d: Destination, input: TripInput, flight: FlightQuote, stayNight?: number): CostBreakdown {
  const nights = Math.max(input.days - 1, 1);
  const groupShare = input.travellers >= 4 ? 0.7 : input.travellers >= 2 ? 0.85 : 1;
  const tierActivityMult = { budget: 1, comfort: 1.2, luxury: 1.8 }[input.tier];
  const cost = {
    flights: flight.price,
    stay: roundTo((stayNight ?? stayPerPersonNight(d, input)) * nights),
    food: roundTo(d.foodPerDay[input.tier] * input.days),
    activities: roundTo(pickActivities(d, input).reduce((s, x) => s + x.cost, 0) * tierActivityMult),
    transport: roundTo(d.transportPerDay[input.tier] * input.days * groupShare),
  };
  return { ...cost, total: sumBudget(cost) };
}

export const isVegDiet = (diet: TripInput["diet"]) => diet === "vegetarian" || diet === "jain" || diet === "vegan";

/** A warning for the trip's month (monsoon, heat, closed roads), if there is one. */
export function cautionFor(d: Destination, startDate: string) {
  const month = Number(startDate.slice(5, 7));
  return d.cautions?.find((c) => c.months.includes(month))?.note ?? null;
}

export function scoreDestination(d: Destination, input: TripInput, cost: CostBreakdown): Omit<Suggestion, "destination" | "flight" | "cost"> {
  const budgetTotal = sumBudget(input.budget);
  const overBudgetBy = Math.max(cost.total - budgetTotal, 0);
  const month = Number(input.startDate.slice(5, 7));
  const reasons: string[] = [];
  let score = 100;

  // Budget fit dominates: every 10% over budget costs 25 points.
  if (overBudgetBy > 0) {
    score -= (overBudgetBy / budgetTotal) * 250;
  } else {
    const spare = budgetTotal - cost.total;
    reasons.push(`Fits your budget with ₹${spare.toLocaleString("en-IN")} to spare per person`);
    score += Math.min((spare / budgetTotal) * 30, 15);
  }

  if (cautionFor(d, input.startDate)) score -= 20;

  if (d.bestMonths.includes(month)) {
    reasons.push("Great season for your dates");
    score += 15;
  } else {
    score -= 15;
  }

  const matched = d.tags.filter((t) => input.interests.includes(t));
  if (matched.length) reasons.push(`Good for ${matched.join(", ")}`);
  score += matched.length * 8;

  if (isVegDiet(input.diet)) {
    score += (d.vegScore - 3) * 8;
    if (d.vegScore >= 4) reasons.push("Easy to find vegetarian food");
  }

  if (d.international && input.days < 4) score -= 20;

  // Nearby first: places in your own zone (or the one next door) rank higher, much more so on
  // short trips, where a long journey eats the holiday. A 2-day trip from Kolkata should lead
  // with Digha, Puri and the hills, not Goa.
  const origin = findOrigin(input.origin);
  if (origin && d.zone) {
    const near = nearness(origin.zone, d.zone);
    const short = input.days <= 3;
    const medium = input.days <= 5;
    score += {
      same: short ? 30 : medium ? 15 : 6,
      neighbour: short ? 12 : medium ? 6 : 2,
      far: short ? -20 : medium ? -6 : 0,
    }[near];
    if (near === "same" && short && origin.zone === d.zone) reasons.push(`Close to ${origin.city}, good for a short trip`);
  }
  // Abroad, the same idea by real flying distance: Bangkok and Vietnam suit Kolkata, Dubai suits
  // Mumbai and Ahmedabad, Sri Lanka suits the south.
  if (origin && d.international) {
    const km = distanceKm(origin, d);
    score += abroadNearnessPoints(km, input.days);
    if (km < 2000) reasons.push(`One of the shortest flights abroad from ${origin.city}`);
  }
  if (input.party === "students" && d.stay.hostelBed <= 900) {
    reasons.push("Lots of student-friendly hostels");
    score += 5;
  }

  return { fitScore: Math.round(score), overBudgetBy, reasons };
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
