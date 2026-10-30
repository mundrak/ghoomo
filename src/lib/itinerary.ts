import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cautionFor, estimateCost, inr, isVegDiet } from "./budget";
import { travelMode } from "./travel";
import type { Destination, FlightQuote, StayQuote, TripInput } from "./types";

export const ItinerarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  stayRecommendation: z.object({
    area: z.string().describe("Neighbourhood or area to stay in"),
    why: z.string(),
  }),
  days: z.array(
    z.object({
      day: z.number().int(),
      title: z.string(),
      items: z.array(
        z.object({
          time: z.string().describe('e.g. "Morning", "1:00 PM"'),
          category: z.enum(["activities", "food", "transport"]),
          title: z.string(),
          details: z.string(),
          costPerPerson: z.number().describe("INR per person; 0 if free"),
        }),
      ),
    }),
  ),
  foodTips: z.array(z.string()),
  moneySavingTips: z.array(z.string()),
  beforeYouGo: z.array(z.string()).describe("Visa, permits, SIM, forex, packing"),
});

export type Itinerary = z.infer<typeof ItinerarySchema>;

export interface TripContext {
  input: TripInput;
  destination: Destination;
  flight: FlightQuote;
  stay: StayQuote;
}

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const systemPrompt = (days: number) => `You plan trips for Indian travellers — mostly students and friend groups of 4-6 — who care about getting the most out of a fixed budget.

Plan a realistic day-by-day itinerary for the trip described. Rules:
- Every cost is in INR per person. Keep each category's total (food, activities, transport) within the per-person budget given for it; getting there (train, bus or flight) and stay are already priced and shown separately, so don't add items for them.
- Use the live prices provided when present. For anything else, give honest current estimates; never invent precise prices to look exact.
- Respect the diet strictly. For vegetarian, Jain or vegan travellers name specific places or dishes that work, and say where it will be hard.
- Day 1 starts with arrival and day ${days} ends with departure; keep those days light.
- For groups, prefer things that are cheaper or more fun shared: group tours, shared cabs, family-style meals.
- Pace: 2-4 items per day plus meals. No filler.
- If there's a season warning for these dates, plan around it (indoor options, early starts, a buffer day) and mention it once in beforeYouGo.
- When the traveller asks for a change, apply it, keep everything else that still fits, and rebalance costs to stay within budget.`;

/** Where the trip starts on arrival day: the station, bus stand or airport, in words. */
function arrivalPoint(d: Destination, flight: FlightQuote) {
  const mode = travelMode(flight);
  if (mode === "train") return { arrive: `Arrive at ${d.ground?.to ?? d.name} station`, leave: "Head to the station", buffer: "30 minutes", note: d.ground && d.ground.to !== d.name ? `The train gets in at ${d.ground.to}; take a cab or local transport on to ${d.name}.` : undefined };
  if (mode === "bus") return { arrive: `Arrive in ${d.name} by bus`, leave: "Head to the bus stand", buffer: "30 minutes", note: undefined };
  if (mode === "none") return { arrive: `Start in ${d.name}`, leave: "Head home", buffer: "", note: undefined };
  return { arrive: `Arrive in ${d.name} and check in`, leave: "Head to the airport", buffer: d.international ? "3 hours" : "2 hours", note: d.arrivalNote };
}

function describeTrip({ input, destination: d, flight, stay }: TripContext) {
  const nights = Math.max(input.days - 1, 1);
  const way = arrivalPoint(d, flight);
  return JSON.stringify(
    {
      destination: `${d.name}, ${d.country}`,
      arrivalNote: way.note,
      startDate: input.startDate,
      days: input.days,
      travellers: input.travellers,
      party: input.party,
      style: input.tier,
      stayType: input.stay,
      diet: input.diet,
      cuisinesTheyLike: input.cuisines,
      interests: input.interests,
      perPersonBudgetINR: input.budget,
      alreadyPriced: {
        gettingThere: `${flight.label ?? "Flight"}: ${inr(flight.price)} return (${flight.source === "live" ? `recent fare${flight.airline ? `, ${flight.airline}` : ""}` : "estimate"})`,
        stay: `${inr(stay.perPersonNight)} per person per night × ${nights} nights (${stay.source === "live" ? `live rate at ${stay.name}` : "estimate"})`,
      },
      visaForIndians: d.visa,
      seasonWarningForTheseDates: cautionFor(d, input.startDate) ?? undefined,
      knownActivities: d.activities.map((x) => `${x.name} (~${inr(x.cost)})`),
    },
    null,
    2,
  );
}

// USD per million tokens, used to track spend against the daily cap.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};
// Server-side refusal fallbacks are available for these models only.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export const aiModel = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";

export function callCostUsd(model: string, usage: { input_tokens: number; output_tokens: number }) {
  const price = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}

export async function generateItinerary(
  ctx: TripContext,
  current?: Itinerary,
  change?: string,
): Promise<{ itinerary: Itinerary; costUsd: number }> {
  const client = new Anthropic();
  const model = aiModel();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Plan this trip:\n${describeTrip(ctx)}` },
  ];
  if (current && change) {
    messages.push(
      { role: "assistant", content: JSON.stringify(current) },
      { role: "user", content: `Update the itinerary: ${change}` },
    );
  }

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: systemPrompt(ctx.input.days),
    messages,
    // Edits are smaller jobs than a fresh plan, so they run at lower effort to save tokens.
    output_config: { effort: change ? "low" : "medium", format: betaZodOutputFormat(ItinerarySchema) },
    ...(FALLBACK_MODELS.has(model) && { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });

  const costUsd = callCostUsd(response.model, response.usage);
  console.log(
    `[ai] ${change ? "edit" : "plan"} model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} cost=$${costUsd.toFixed(4)}`,
  );

  if (response.stop_reason === "refusal") throw new Error("The planner couldn't help with that request.");
  if (!response.parsed_output) throw new Error("The planner returned an incomplete itinerary. Please try again.");
  return { itinerary: response.parsed_output, costUsd };
}

/** Activities for the full days: best interest matches first, but only what the activities budget covers. */
function activitiesWithinBudget(d: Destination, input: TripInput) {
  const slots = Math.max(input.days - 2, 1);
  const mult = { budget: 1, comfort: 1.2, luxury: 1.8 }[input.tier];
  // Best interest matches first; ties keep the order they're listed in, which puts the highlights first.
  const ranked = d.activities
    .map((act, i) => ({ act, i, score: act.tags.filter((t) => input.interests.includes(t)).length }))
    .sort((x, y) => y.score - x.score || x.i - y.i);
  const chosen: { name: string; cost: number }[] = [];
  let spent = 0;
  for (const { act } of ranked) {
    if (chosen.length === slots) break;
    const cost = Math.round(act.cost * mult);
    if (spent + cost > input.budget.activities) continue;
    chosen.push({ name: act.name, cost });
    spent += cost;
  }
  return chosen;
}

const MEALS: Record<TripInput["tier"], string> = {
  budget: "Thalis, street food and cheap local places",
  comfort: "Local restaurants and cafés",
  luxury: "Good restaurants, with one special dinner",
};

function foodTips(d: Destination, input: TripInput) {
  const tips: string[] = [];
  const veg = isVegDiet(input.diet);
  if (veg && d.vegScore >= 4) tips.push("Vegetarian food is easy to find here, including plenty of pure-veg places.");
  if (veg && d.vegScore <= 2) tips.push("Vegetarian options are thin here. Indian and South Indian restaurants are the safest bet; ask about fish sauce and meat stock.");
  if (veg && d.vegScore === 3) tips.push("Vegetarian food is available but not everywhere. Check menus before you sit down.");
  if (input.diet === "jain") tips.push("For Jain food, ask for no onion, garlic or root vegetables. Pure-veg and Gujarati or Marwari places handle this best.");
  if (input.diet === "halal" && !d.international) tips.push("Halal food is easiest to find in the older market areas and near mosques.");
  if (input.diet === "vegan") tips.push("Ask for no ghee, curd or paneer: many Indian dishes use them by default.");
  if (input.tier === "budget") tips.push("Eat your big meal at lunch: thalis are cheaper and more filling than dinner menus.");
  return tips;
}

function savingTips(d: Destination, input: TripInput, flight: FlightQuote, planned: { food: number; transport: number }) {
  const tips: string[] = [];
  const mode = travelMode(flight);
  if (mode === "train") tips.push("Book train tickets early: IRCTC opens bookings 60 days ahead and sleeper and 3AC sell out on popular routes.");
  if (mode === "bus") tips.push("Compare bus operators on redBus and book a day or two ahead; overnight sleepers save a night's stay.");
  if (mode === "flight" && !d.international) tips.push("Flight prices usually climb in the last two weeks, so book sooner rather than later.");
  if (input.travellers >= 4 && input.stay === "hostel") tips.push(`For ${input.travellers} people, a whole homestay or Airbnb can cost about the same as hostel beds and gives you a kitchen.`);
  if (input.travellers >= 3) tips.push(`Split autos and cabs between the ${input.travellers} of you rather than paying per head on tours.`);
  if (planned.food > input.budget.food) tips.push(`Food is planned at ${inr(planned.food)}, ${inr(planned.food - input.budget.food)} over your food budget. More street food and thalis will close the gap.`);
  if (planned.transport > input.budget.transport) tips.push(`Getting around is planned at ${inr(planned.transport)}, ${inr(planned.transport - input.budget.transport)} over budget. Shared autos and buses instead of cabs will close the gap.`);
  return tips;
}

/**
 * A plan built from ghoomo's own data: used without an AI key, or once AI limits are reached.
 * Uses the same estimates as the departures board, so the numbers match, and only picks
 * activities the activities budget covers.
 */
export function templateItinerary({ input, destination: d, flight, stay }: TripContext): Itinerary {
  const way = arrivalPoint(d, flight);
  const cost = estimateCost(d, input, flight, stay.perPersonNight);
  const food = Math.round(cost.food / input.days / 10) * 10;
  const transport = Math.round(cost.transport / input.days / 10) * 10;
  const acts = activitiesWithinBudget(d, input);
  const meals = { time: "Meals", category: "food" as const, title: MEALS[input.tier], details: "", costPerPerson: food };

  const days = Array.from({ length: input.days }, (_, i) => {
    const day = i + 1;
    const items: Itinerary["days"][number]["items"] = [];
    let title: string;
    if (day === 1) {
      title = "Arrival";
      items.push({ time: "Arrival", category: "transport", title: way.arrive, details: way.note ?? "Take a prepaid cab or auto to your stay and check in.", costPerPerson: transport });
      if (input.days === 2 && acts[0]) items.push({ time: "Afternoon", category: "activities", title: acts[0].name, details: "", costPerPerson: acts[0].cost });
      else items.push({ time: "Evening", category: "activities", title: `Settle in and walk around ${d.hotelCity}`, details: "", costPerPerson: 0 });
    } else if (day === input.days) {
      title = "Departure";
      items.push({ time: "Departure", category: "transport", title: way.leave, details: way.buffer ? `Get there ${way.buffer} before you leave.` : "", costPerPerson: transport });
    } else {
      const act = acts[day - 2];
      title = act?.name ?? "Free day";
      items.push(
        act
          ? { time: "Morning", category: "activities", title: act.name, details: "", costPerPerson: act.cost }
          : { time: "All day", category: "activities", title: "Free day to explore", details: "Wander, rest, or redo a favourite.", costPerPerson: 0 },
      );
      items.push({ time: "Through the day", category: "transport", title: "Getting around", details: "Autos, shared cabs or local buses.", costPerPerson: transport });
    }
    items.push(meals);
    return { day, title, items };
  });

  return {
    title: `${input.days} days in ${d.name}`,
    summary: `A starter plan for ${d.name}, sized to your budget. Swap anything you like.`,
    stayRecommendation: { area: d.hotelCity, why: "Central and well connected." },
    days,
    foodTips: foodTips(d, input),
    moneySavingTips: savingTips(d, input, flight, { food: cost.food, transport: cost.transport }),
    beforeYouGo: [
      ...(d.international ? [`Visa for Indian passports: ${d.visa}. Check the rules before you book.`] : []),
      ...(travelMode(flight) === "train" ? ["Carry a photo ID for train travel: the ticket checker asks for it."] : []),
      "Hotels and hostels ask for ID at check-in: carry Aadhaar or a passport for everyone in the group.",
    ],
  };
}
