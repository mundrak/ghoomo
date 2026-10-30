import { NextResponse } from "next/server";
import { eventStats } from "@/lib/events";
import { storageAvailable } from "@/lib/kv";

export const dynamic = "force-dynamic";

/**
 * Usage counts for the last 14 days (or ?days=1–60). Needs ?key= matching the STATS_KEY
 * environment variable, so only you can read it. Without STATS_KEY set, this page is off.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = process.env.STATS_KEY;
  if (!key || url.searchParams.get("key") !== key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!storageAvailable) return NextResponse.json({ error: "Usage counts need Redis connected." }, { status: 503 });
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 14, 1), 60);
  return NextResponse.json(await eventStats(days));
}
