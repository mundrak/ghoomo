import { NextResponse } from "next/server";
import { redisSource, storageAvailable, store } from "@/lib/kv";

export const dynamic = "force-dynamic";

/**
 * A quick health check to open in the browser: is Redis connected, and does it answer?
 * Shows variable names only, never their values.
 */
export async function GET() {
  let redisWorks: boolean | null = null;
  if (redisSource) {
    try {
      await store.set("status:ping", String(Date.now()), 60);
      redisWorks = (await store.get("status:ping")) !== null;
    } catch {
      redisWorks = false;
    }
  }
  return NextResponse.json({
    redisConnected: Boolean(redisSource),
    redisVariables: redisSource,
    redisWorks,
    savedTripsAndGroups: storageAvailable && redisWorks !== false,
    aiPlans: Boolean(process.env.ANTHROPIC_API_KEY),
    liveFlightFares: Boolean(process.env.TRAVELPAYOUTS_TOKEN),
    liveHotelRates: Boolean(process.env.LITEAPI_KEY),
  });
}
