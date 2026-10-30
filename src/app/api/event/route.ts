import { NextResponse } from "next/server";
import { z } from "zod";
import { countEvent, EVENTS, FEEDBACK_REASONS } from "@/lib/events";
import { storageAvailable } from "@/lib/kv";
import { identify, rateLimit, withVisitor } from "@/lib/limits";

const Body = z.object({ name: z.enum(EVENTS), reason: z.enum(FEEDBACK_REASONS).optional() });

/** Counts one anonymous usage event. Always answers quickly; counting is best-effort. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  if (!storageAvailable) return new NextResponse(null, { status: 204 });
  const visitor = identify(req);
  if (await rateLimit(visitor, "event", 120, 2000)) {
    try {
      await countEvent(parsed.data.name, parsed.data.name === "plan_not_useful" ? parsed.data.reason : undefined);
    } catch {
      // Counting must never break the app.
    }
  }
  return withVisitor(new NextResponse(null, { status: 204 }), visitor);
}
