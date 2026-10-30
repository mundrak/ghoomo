import { presetBudget } from "./budget";
import type { TripInput } from "./types";

// Five trips that cover ghoomo's range: overland weekend, veg group, couple on comfort,
// big student group in the hills, and a trip abroad. Same inputs for every model.

const start = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

const base = (t: Omit<TripInput, "budget" | "startDate" | "cuisines" | "scope"> & { daysAhead?: number }): TripInput => ({
  ...t,
  startDate: start(t.daysAhead ?? 30),
  budget: presetBudget(t.tier, t.days),
  cuisines: [],
  scope: "anywhere",
});

export const COMPARE_TRIPS: { label: string; destinationId: string; input: TripInput }[] = [
  { label: "5 students, Bengaluru → Gokarna, 3 days, budget", destinationId: "gokarna", input: base({ origin: "BLR", days: 3, party: "students", travellers: 5, tier: "budget", stay: "hostel", diet: "any", interests: ["beach", "adventure"] }) },
  { label: "4 friends, Delhi → Rishikesh, 4 days, vegetarian", destinationId: "rishikesh", input: base({ origin: "DEL", days: 4, party: "group", travellers: 4, tier: "budget", stay: "hostel", diet: "vegetarian", interests: ["adventure", "nature"] }) },
  { label: "Couple, Mumbai → Goa, 5 days, comfort", destinationId: "goa", input: base({ origin: "BOM", days: 5, party: "couple", travellers: 2, tier: "comfort", stay: "hotel", diet: "any", interests: ["beach", "nightlife", "food"] }) },
  { label: "6 students, Kolkata → Darjeeling, 4 days, Jain", destinationId: "darjeeling", input: base({ origin: "CCU", days: 4, party: "students", travellers: 6, tier: "budget", stay: "airbnb", diet: "jain", interests: ["mountains", "culture"] }) },
  { label: "5 friends, Delhi → Bangkok & Phuket, 6 days, comfort", destinationId: "thailand", input: base({ origin: "DEL", days: 6, party: "group", travellers: 5, tier: "comfort", stay: "hotel", diet: "any", interests: ["beach", "nightlife", "food"], daysAhead: 45 }) },
];
