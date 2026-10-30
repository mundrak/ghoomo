import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findDestination } from "@/data/destinations";
import { aiEnabled, generateItinerary, type Itinerary, type PlanProgress, PREMIUM_MODEL, STANDARD_MODEL, templateItinerary, wantsPremium } from "@/lib/itinerary";
import { addPremiumSpend, allowance, cacheGet, cacheSet, identify, planCacheKey, premiumAvailable, recordUse, withVisitor, type Allowance } from "@/lib/limits";
import { quoteTravel } from "@/lib/providers/flights";
import { quoteStay } from "@/lib/providers/stays";
import { FlightQuoteSchema, ItineraryInputSchema, MAX_CHANGE_CHARS, StayQuoteSchema, TripInputSchema } from "@/lib/validate";

export const maxDuration = 300;

const BodySchema = z
  .object({
    input: TripInputSchema,
    destinationId: z.string().max(40),
    // Present when refining: reuse the quotes and current plan instead of re-fetching.
    // All of it is checked with tight bounds, because it goes into the AI prompt.
    flight: FlightQuoteSchema.optional(),
    stay: StayQuoteSchema.optional(),
    itinerary: ItineraryInputSchema.optional(),
    change: z.string().trim().min(1).max(MAX_CHANGE_CHARS).optional(),
  })
  .refine((b) => !b.itinerary || b.itinerary.days.length <= b.input.days, "The plan has more days than the trip");

// A long AI-written 14-day plan fits comfortably; anything bigger isn't a real request.
const MAX_BODY_CHARS = 80_000;

const usage = (a: Pick<Allowance, "plansLeft" | "editsLeft">) => ({ plansLeft: a.plansLeft, editsLeft: a.editsLeft });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Some trip details look wrong. Please check the form." }, { status: 400 });
  const body = parsed.data;

  const destination = findDestination(body.destinationId);
  if (!destination) return NextResponse.json({ error: "Unknown destination" }, { status: 400 });

  const [flight, stay] = await Promise.all([
    body.flight ?? quoteTravel(body.input, destination),
    body.stay ?? quoteStay(body.input, destination),
  ]);
  const ctx = { input: body.input, destination, flight, stay };
  const isEdit = Boolean(body.change && body.itinerary);

  if (!aiEnabled()) {
    if (isEdit) return NextResponse.json({ error: "Editing by chat isn't switched on yet." }, { status: 400 });
    return NextResponse.json({ itinerary: templateItinerary(ctx), flight, stay, ai: false, aiAvailable: false });
  }

  const visitor = identify(req);
  const reply = (payload: unknown, init?: ResponseInit) => withVisitor(NextResponse.json(payload, init), visitor);
  const cacheKey = planCacheKey(body.input, destination.id);

  // Someone already asked for this exact trip: serve it for free.
  if (!isEdit) {
    const cached = await cacheGet<{ itinerary: Itinerary; premium: boolean }>(cacheKey);
    if (cached) {
      const left = await allowance(visitor, "plan");
      return reply({ itinerary: cached.itinerary, flight, stay, ai: true, premium: cached.premium, aiAvailable: true, ...usage(left) });
    }
  }

  const left = await allowance(visitor, isEdit ? "edit" : "plan");
  if (!left.allowed) {
    if (isEdit) return reply({ error: left.reason, ...usage(left) }, { status: 429 });
    return reply({
      itinerary: templateItinerary(ctx),
      flight,
      stay,
      ai: false,
      aiAvailable: true,
      notice: left.reason,
      ...usage(left),
    });
  }

  // Luxury, Jain and vegan trips get the premium model while today's premium budget lasts.
  // Edits use the same rule, so a plan is usually edited by the model that wrote it.
  const premium = wantsPremium(body.input) && (await premiumAvailable());
  const model = premium ? PREMIUM_MODEL() : STANDARD_MODEL();

  const run = async (onProgress?: (p: PlanProgress) => void) => {
    const { itinerary, costUsd } = await generateItinerary(ctx, body.itinerary, body.change, model, onProgress);
    await recordUse(visitor, isEdit ? "edit" : "plan", costUsd);
    if (premium) await addPremiumSpend(costUsd);
    if (!isEdit) await cacheSet(cacheKey, { itinerary, premium });
    const after = isEdit ? { ...left, editsLeft: left.editsLeft - 1 } : { ...left, plansLeft: left.plansLeft - 1 };
    return { itinerary, flight, stay, ai: true, premium, aiAvailable: true, ...usage(after) };
  };
  // A failed plan still gets a usable starter plan.
  const starter = () => ({
    itinerary: templateItinerary(ctx),
    flight,
    stay,
    ai: false,
    aiAvailable: true,
    notice: "Our AI planner couldn't be reached just now, so here's a starter plan. Try again in a few minutes.",
    ...usage(left),
  });

  // New plans stream when the browser asks: one JSON object per line, {"progress": …} while the
  // plan is written, then {"done": …} with the same payload the plain response would have.
  if (!isEdit && req.headers.get("accept")?.includes("application/x-ndjson")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        try {
          send({ done: await run((progress) => send({ progress })) });
        } catch (err) {
          console.error("[ai] call failed", err);
          send({ done: starter() });
        }
        controller.close();
      },
    });
    return withVisitor(
      new NextResponse(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } }),
      visitor,
    );
  }

  try {
    return reply(await run());
  } catch (err) {
    console.error("[ai] call failed", err);
    if (!isEdit) return reply(starter());
    if (err instanceof Anthropic.RateLimitError) {
      return reply({ error: "The planner is busy. Try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return reply({ error: `Planner error (${err.status}).` }, { status: 502 });
    }
    return reply({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
