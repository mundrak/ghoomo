import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { inr, pickActivities } from "./budget";
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
- Every cost is in INR per person. Keep each category's total (food, activities, transport) within the per-person budget given for it; flights and stay are already priced and shown separately, so don't add items for them.
- Use the live prices provided when present. For anything else, give honest current estimates; never invent precise prices to look exact.
- Respect the diet strictly. For vegetarian, Jain or vegan travellers name specific places or dishes that work, and say where it will be hard.
- Day 1 starts with arrival and day ${days} ends with departure; keep those days light.
- For groups, prefer things that are cheaper or more fun shared: group tours, shared cabs, family-style meals.
- Pace: 2-4 items per day plus meals. No filler.
- When the traveller asks for a change, apply it, keep everything else that still fits, and rebalance costs to stay within budget.`;

function describeTrip({ input, destination: d, flight, stay }: TripContext) {
  const nights = Math.max(input.days - 1, 1);
  return JSON.stringify(
    {
      destination: `${d.name}, ${d.country}`,
      arrivalNote: d.arrivalNote,
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
        flight: `${inr(flight.price)} return (${flight.source === "live" ? `live fare${flight.airline ? `, ${flight.airline}` : ""}` : "estimate"})`,
        stay: `${inr(stay.perPersonNight)} per person per night × ${nights} nights (${stay.source === "live" ? `live rate at ${stay.name}` : "estimate"})`,
      },
      visaForIndians: d.visa,
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

/** A simple itinerary built from our own data: used without an AI key, or once AI limits are reached. */
export function templateItinerary({ input, destination: d }: TripContext): Itinerary {
  const acts = pickActivities(d, input);
  const food = d.foodPerDay[input.tier];
  const transport = d.transportPerDay[input.tier];
  const days = Array.from({ length: input.days }, (_, i) => {
    const day = i + 1;
    const items: Itinerary["days"][number]["items"] = [];
    if (day === 1) {
      items.push({
        time: "Arrival",
        category: "transport",
        title: `Arrive at ${d.airport} and check in`,
        details: d.arrivalNote ?? "Take a prepaid cab or airport transfer to your stay.",
        costPerPerson: transport,
      });
    } else if (day === input.days) {
      const buffer = d.international ? "3 hours" : "2 hours";
      items.push({ time: "Departure", category: "transport", title: "Head to the airport", details: `Reach the airport ${buffer} before your flight.`, costPerPerson: transport });
    } else {
      const act = acts[day - 2];
      if (act) items.push({ time: "Morning", category: "activities", title: act.name, details: "", costPerPerson: act.cost });
      else items.push({ time: "All day", category: "activities", title: "Free day to explore", details: "", costPerPerson: 0 });
      items.push({ time: "Through the day", category: "transport", title: "Getting around", details: "", costPerPerson: transport });
    }
    items.push({ time: "Meals", category: "food", title: "Breakfast, lunch and dinner", details: "", costPerPerson: food });
    const title = day === 1 ? "Arrival" : day === input.days ? "Departure" : (acts[day - 2]?.name ?? "Free day");
    return { day, title, items };
  });
  return {
    title: `${input.days} days in ${d.name}`,
    summary: "A starter plan built from our destination data.",
    stayRecommendation: { area: d.hotelCity, why: "Central and well connected." },
    days,
    foodTips: [],
    moneySavingTips: [],
    beforeYouGo: [`Visa: ${d.visa}`],
  };
}
