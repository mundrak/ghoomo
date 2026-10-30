import { NextResponse } from "next/server";
import { z } from "zod";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { DESTINATIONS } from "@/data/destinations";
import { defaultTrip } from "@/lib/defaults";
import { aiEnabled, generateItinerary, STANDARD_MODEL } from "@/lib/itinerary";
import { cacheGet, cacheSet, planCacheKey } from "@/lib/limits";
import { quoteTravel } from "@/lib/providers/flights";
import { quoteStay } from "@/lib/providers/stays";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Pre-generated plans last longer than ordinary cached ones: they're made for a whole month.
const PREGEN_SECONDS = 45 * 86_400;
// Plans written at once. Kept low so a run doesn't hit the API's rate limits.
const CONCURRENCY = 6;

const Body = z.object({
  key: z.string().max(200),
  origin: z.string().length(3),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

/**
 * Writes AI plans in advance for the trip the form starts with (5 students, 5 days, budget, hostel),
 * from one city to every destination, for one month. Anyone who picks a destination without changing
 * those settings then gets a plan instantly, at no cost. Plans that already exist are skipped, so a
 * run can be repeated safely. Locked with STATS_KEY. This spend doesn't count toward the daily cap.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const key = process.env.STATS_KEY;
  if (!parsed.success || !key || parsed.data.key !== key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!aiEnabled()) return NextResponse.json({ error: "AI isn't switched on: ANTHROPIC_API_KEY isn't set." }, { status: 503 });
  const { origin, month } = parsed.data;
  if (!ORIGIN_AIRPORTS.some((a) => a.code === origin)) return NextResponse.json({ error: "Unknown city" }, { status: 400 });

  const input = { ...defaultTrip(), origin, startDate: `${month}-15` };
  const result = { made: 0, skipped: 0, failed: 0, costUsd: 0, errors: [] as string[] };

  const queue = [...DESTINATIONS];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      const cacheKey = planCacheKey(input, d.id);
      if (await cacheGet(cacheKey)) {
        result.skipped++;
        continue;
      }
      try {
        const [flight, stay] = await Promise.all([quoteTravel(input, d), quoteStay(input, d)]);
        const { itinerary, costUsd } = await generateItinerary({ input, destination: d, flight, stay }, undefined, undefined, STANDARD_MODEL());
        await cacheSet(cacheKey, { itinerary, premium: false }, PREGEN_SECONDS);
        result.made++;
        result.costUsd += costUsd;
      } catch (err) {
        result.failed++;
        result.errors.push(`${d.name}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[pregen] ${origin} ${month}: made=${result.made} skipped=${result.skipped} failed=${result.failed} cost=$${result.costUsd.toFixed(3)}`);
  return NextResponse.json(result);
}
