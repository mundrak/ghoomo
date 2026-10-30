import { NextResponse } from "next/server";
import { z } from "zod";
import { storageAvailable } from "@/lib/kv";
import { identify, rateLimit, withVisitor } from "@/lib/limits";
import { addLimit, createGroup, GroupSizeSchema, groupStatus, LimitSchema } from "@/lib/shared";

const Body = z.object({ size: GroupSizeSchema, limit: LimitSchema.optional() });

/** Starts a group check-in. The person starting it can add their own limit straight away. */
export async function POST(req: Request) {
  if (!storageAvailable) return NextResponse.json({ error: "Group check-in isn't switched on yet." }, { status: 503 });
  const visitor = identify(req);
  const reply = (payload: unknown, init?: ResponseInit) => withVisitor(NextResponse.json(payload, init), visitor);
  if (!(await rateLimit(visitor, "group-new", 10, 100))) return reply({ error: "Too many new groups in a minute. Try again shortly." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Pick a group size between 2 and 12." }, { status: 400 });
  const id = await createGroup(parsed.data.size);
  if (parsed.data.limit) await addLimit(id, visitor.browser, parsed.data.limit);
  return reply({ id, status: await groupStatus(id, visitor.browser) });
}
