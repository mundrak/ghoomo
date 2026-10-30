import { presetBudget } from "./budget";
import type { TripInput } from "./types";

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

/**
 * The trip the form starts with. Pre-generated plans (see /api/pregenerate) are made for this
 * trip from each city, so keep the two in step.
 */
export function defaultTrip(): TripInput {
  return {
    origin: "DEL",
    startDate: defaultStart(),
    days: 5,
    party: "students",
    travellers: 5,
    tier: "budget",
    budget: presetBudget("budget", 5),
    stay: "hostel",
    diet: "any",
    cuisines: [],
    interests: [],
    scope: "anywhere",
  };
}
