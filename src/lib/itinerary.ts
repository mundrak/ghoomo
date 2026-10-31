import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cautionFor, estimateCost, inr, isVegDiet } from "./budget";
import { travelMode } from "./travel";
import type { Destination, FlightQuote, StayQuote, TripInput } from "./types";

const ItemSchema = z.object({
  time: z.string().describe('e.g. "Morning", "1:00 PM"'),
  category: z.enum(["activities", "food", "transport"]),
  title: z.string(),
  details: z.string().describe("One or two sentences"),
  costPerPerson: z.number().describe("INR per person; 0 if free"),
});

export const ItinerarySchema = z.object({
  title: z.string().describe("Short, like a headline: under 50 characters"),
  summary: z.string().describe("Two or three sentences, under 350 characters. Don't repeat the costs."),
  stayRecommendation: z.object({
    area: z.string().describe("Neighbourhood or area to stay in"),
    why: z.string().describe("One or two sentences"),
  }),
  days: z.array(
    z.object({
      day: z.number().int(),
      title: z.string(),
      items: z.array(ItemSchema),
    }),
  ),
  foodTips: z.array(z.string()).describe("Up to 4 short tips"),
  moneySavingTips: z.array(z.string()).describe("Up to 4 short tips"),
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

// Two models: a cheap one for most trips, and a stronger one where plan quality matters most.
// Luxury trips get the stronger model, and so do Jain and vegan trips, because the cheap model
// was found suggesting momos and aloo dishes to a Jain group.
export const STANDARD_MODEL = () => process.env.AI_STANDARD_MODEL || "claude-haiku-5-5";
export const PREMIUM_MODEL = () => process.env.AI_PREMIUM_MODEL || "claude-opus-5-5";

/** Whether this trip should get the stronger model (if today's premium budget allows). */
export const wantsPremium = (input: TripInput) => input.tier === "luxury" || input.diet === "jain" || input.diet === "vegan";
export const COMPARE_MODELS = Object.keys(PRICES);

export function callCostUsd(model: string, usage: { input_tokens: number; output_tokens: number }) {
  const price = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}

type Effort = "low" | "medium";

/** One structured call to the model. Returns the parsed result and what it cost. */
async function ask<T extends z.ZodType>(
  model: string,
  schema: T,
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  effort: Effort,
  label: string,
): Promise<{ parsed: z.infer<T>; costUsd: number }> {
  const response = await new Anthropic().beta.messages.parse({
    model,
    max_tokens: 16000,
    system,
    messages,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...(FALLBACK_MODELS.has(model) && { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  });
  const costUsd = callCostUsd(response.model, response.usage);
  console.log(`[ai] ${label} model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} cost=$${costUsd.toFixed(4)}`);
  if (response.stop_reason === "refusal") throw new Error("The planner couldn't help with that request.");
  if (!response.parsed_output) throw new Error("The planner returned an incomplete itinerary. Please try again.");
  return { parsed: response.parsed_output as z.infer<T>, costUsd };
}

/** Writes or edits a whole plan in one call. Used for edits, the comparison page and pre-generated plans. */
export async function generateItinerary(
  ctx: TripContext,
  current?: Itinerary,
  change?: string,
  /** The model to use (see STANDARD_MODEL and PREMIUM_MODEL). */
  model: string = STANDARD_MODEL(),
): Promise<{ itinerary: Itinerary; costUsd: number; model: string; seconds: number }> {
  const started = Date.now();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `Plan this trip:\n${describeTrip(ctx)}` }];
  if (current && change) {
    messages.push(
      { role: "assistant", content: JSON.stringify(current) },
      { role: "user", content: `Update the itinerary: ${change}` },
    );
  }
  // Edits are smaller jobs than a fresh plan, so they run at lower effort to save tokens.
  const { parsed, costUsd } = await ask(model, ItinerarySchema, systemPrompt(ctx.input.days), messages, change ? "low" : "medium", change ? "edit" : "plan");
  return { itinerary: parsed, costUsd, model, seconds: Math.round((Date.now() - started) / 1000) };
}

// ---------------------------------------------------------------------------
// Faster new plans: a short outline first, then every day written at the same time.

const OutlineSchema = ItinerarySchema.omit({ days: true }).extend({
  days: z.array(
    z.object({
      day: z.number().int(),
      title: z.string(),
      plan: z
        .string()
        .describe("This day's main stops and activities in one sentence, specific enough that the day can be detailed on its own without repeating another day"),
    }),
  ),
});
export type Outline = z.infer<typeof OutlineSchema>;

const DayItemsSchema = z.object({ items: z.array(ItemSchema) });

const OUTLINE_RULES = `

You are writing the OUTLINE only: the title, summary, where to stay, tips, and one line per day saying what that day covers. Each day will be detailed separately afterwards, so spread the best activities across the days without repeats, and keep the whole trip within budget.`;

const DAY_RULES = `

You are detailing ONE day of a trip that has already been outlined. Write only that day's items (meals included), following the outline for that day and not repeating what other days cover. Keep this day roughly within its share of the budget, unless the outline puts the trip's big activity on this day.`;

export interface IncrementalHandlers {
  /** The outline is ready: title, summary, stay, tips and each day's one-line plan. */
  outline?: (outline: Outline) => void;
  /** One day's items are ready. */
  day?: (day: Itinerary["days"][number]) => void;
}

/**
 * Writes a new plan in pieces so it can be shown sooner: an outline first (a few seconds), then
 * every day in parallel. The total wait is roughly the outline plus the slowest single day, instead
 * of one long call that writes every day in turn. Costs a little more in input tokens, because each
 * day's call repeats the trip details.
 */
export async function generateItineraryIncremental(
  ctx: TripContext,
  model: string,
  on: IncrementalHandlers = {},
): Promise<{ itinerary: Itinerary; costUsd: number; model: string; seconds: number }> {
  const started = Date.now();
  const { input } = ctx;
  const trip = describeTrip(ctx);
  const system = systemPrompt(input.days);

  const outline = await ask(model, OutlineSchema, system + OUTLINE_RULES, [{ role: "user", content: `Outline this trip:\n${trip}` }], "medium", "outline");
  let costUsd = outline.costUsd;
  // The model occasionally returns the wrong number of days; the trip length wins.
  const plans = Array.from({ length: input.days }, (_, i) => {
    const d = outline.parsed.days[i];
    return { day: i + 1, title: d?.title ?? `Day ${i + 1}`, plan: d?.plan ?? "A free day to explore at your own pace." };
  });
  on.outline?.({ ...outline.parsed, days: plans });

  const share = (n: number) => Math.round(n / input.days);
  const dayBudget = { food: share(input.budget.food), activities: share(input.budget.activities), transport: share(input.budget.transport) };
  const fallbackDays = () => templateItinerary(ctx).days;

  const days = await Promise.all(
    plans.map(async (p) => {
      const content =
        `The trip:\n${trip}\n\nThe outline, one line per day:\n${plans.map((x) => `Day ${x.day}: ${x.title}. ${x.plan}`).join("\n")}\n\n` +
        `Write the items for day ${p.day} of ${input.days} ("${p.title}": ${p.plan}). ` +
        `This day's rough share of the per-person budget in INR: food ${dayBudget.food}, activities ${dayBudget.activities}, local transport ${dayBudget.transport}.`;
      // One retry; if a day still fails, it gets the starter plan's version of that day.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await ask(model, DayItemsSchema, system + DAY_RULES, [{ role: "user", content }], "low", `day ${p.day}`);
          costUsd += r.costUsd;
          const day = { day: p.day, title: p.title, items: r.parsed.items };
          on.day?.(day);
          return day;
        } catch (err) {
          console.error(`[ai] day ${p.day} failed`, err);
        }
      }
      const day = { day: p.day, title: p.title, items: fallbackDays()[p.day - 1]?.items ?? [] };
      on.day?.(day);
      return day;
    }),
  );

  const { days: _outlineDays, ...rest } = outline.parsed;
  void _outlineDays;
  return { itinerary: { ...rest, days }, costUsd, model, seconds: Math.round((Date.now() - started) / 1000) };
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
