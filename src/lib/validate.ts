import { z } from "zod";
import type { TripInput } from "./types";

// Requests come from the browser, so anything can arrive. Clamping sizes here
// also caps how many tokens a single request can make the AI spend.

export const MAX_DAYS = 14;
export const MAX_CHANGE_CHARS = 300;

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
  roomShare: z.number().int().min(1).max(4).optional(),
  diet: z.enum(["any", "vegetarian", "jain", "vegan", "halal", "eggetarian"]),
  cuisines: z.array(z.string().max(30)).max(10),
  interests: z.array(interest).max(8),
  scope: z.enum(["anywhere", "india", "abroad"]),
  destinationId: z.string().max(40).optional(),
}) satisfies z.ZodType<TripInput>;


// ---------------------------------------------------------------------------
// Data the browser sends back when it asks for a plan or an edit. It came from us originally,
// but anything can arrive, so it's checked with tight bounds: these values end up in the AI
// prompt (where size costs money) and on the page (where links must stay safe).

const BOOKING_HOSTS = new Set([
  "www.aviasales.com",
  "aviasales.com",
  "www.skyscanner.co.in",
  "www.hostelworld.com",
  "www.airbnb.co.in",
  "www.booking.com",
  "www.irctc.co.in",
  "www.redbus.in",
]);
const bookingUrl = z
  .string()
  .max(2000)
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && BOOKING_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  }, "Unexpected booking link");

const text = (max: number) => z.string().max(max);

export const FlightQuoteSchema = z.object({
  price: money,
  source: z.enum(["live", "estimate"]),
  mode: z.enum(["flight", "train", "bus", "none"]).optional(),
  label: text(60).optional(),
  hours: z.number().min(0).max(96).optional(),
  airline: text(40).optional(),
  departAt: text(40).optional(),
  returnAt: text(40).optional(),
  transfers: z.number().int().min(0).max(6).optional(),
  bookingUrl,
});

export const StayQuoteSchema = z.object({
  perPersonNight: money,
  source: z.enum(["live", "estimate"]),
  name: text(120).optional(),
  roomName: text(120).optional(),
  bookingUrl,
  options: z.array(z.object({ name: text(120), perPersonNight: money })).max(5).optional(),
});

/** The same shape as ItinerarySchema, with every string and list capped. Used only for input. */
// Generous enough for AI-written plans (which run longer than starter plans), tight enough
// that nobody can stuff the prompt.
export const ItineraryInputSchema = z.object({
  title: text(200),
  summary: text(1500),
  stayRecommendation: z.object({ area: text(200), why: text(800) }),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(MAX_DAYS),
        title: text(200),
        items: z
          .array(
            z.object({
              time: text(60),
              category: z.enum(["activities", "food", "transport"]),
              title: text(200),
              details: text(1200),
              costPerPerson: money,
            }),
          )
          .max(15),
      }),
    )
    .max(MAX_DAYS),
  foodTips: z.array(text(600)).max(12),
  moneySavingTips: z.array(text(600)).max(12),
  beforeYouGo: z.array(text(600)).max(12),
});
