import { NextResponse } from "next/server";
import { z } from "zod";
import { storageAvailable } from "@/lib/kv";
import { identify, rateLimit, withVisitor } from "@/lib/limits";
import { addLimit, groupStatus, LimitSchema } from "@/lib/shared";

const off = () => NextResponse.json({ error: "Group check-in isn't switched on yet." }, { status: 503 });
const missing = "This group link has expired or doesn't exist.";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!storageAvailable) return off();
  const visitor = identify(req);
  const status = await groupStatus((await params).id, visitor.browser);
  if (!status) return withVisitor(NextResponse.json({ error: missing }, { status: 404 }), visitor);
  return withVisitor(NextResponse.json({ status }), visitor);
}

/** Adds or changes this browser's own limit. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!storageAvailable) return off();
  const visitor = identify(req);
  const reply = (payload: unknown, init?: ResponseInit) => withVisitor(NextResponse.json(payload, init), visitor);
  if (!(await rateLimit(visitor, "group-limit", 20, 200))) return reply({ error: "Too many changes in a minute. Try again shortly." }, { status: 429 });
  const parsed = z.object({ limit: LimitSchema }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Enter an amount between ₹1,000 and ₹10,00,000." }, { status: 400 });
  const { id } = await params;
  const result = await addLimit(id, visitor.browser, parsed.data.limit);
  if (result === "missing") return reply({ error: missing }, { status: 404 });
  if (result === "full") return reply({ error: "Everyone in this group has already added theirs." }, { status: 409 });
  return reply({ status: await groupStatus(id, visitor.browser) });
}
