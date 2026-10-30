import { z } from "zod";
import type { TripInput } from "./types";

// Requests come from the browser, so anything can arrive. Clamping sizes here
// also caps how many tokens a single request can make the AI spend.

const money = z.number().finite().min(0).max(1_000_000);
const interest = z.enum(["beach", "mountains", "nightlife", "culture", "adventure", "food", "shopping", "nature"]);

export const TripInputSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(2).max(14),
  party: z.enum(["solo", "couple", "students", "group"]),
  travellers: z.number().int().min(1).max(12),
  tier: z.enum(["budget", "comfort", "luxury"]),
  budget: z.object({ flights: money, stay: money, food: money, activities: money, transport: money }),
  stay: z.enum(["hostel", "hotel", "airbnb"]),
  diet: z.enum(["any", "vegetarian", "jain", "vegan", "halal", "eggetarian"]),
  cuisines: z.array(z.string().max(30)).max(10),
  interests: z.array(interest).max(8),
  scope: z.enum(["anywhere", "india", "abroad"]),
  destinationId: z.string().max(40).optional(),
}) satisfies z.ZodType<TripInput>;

export const MAX_DAYS = 14;
export const MAX_CHANGE_CHARS = 300;
