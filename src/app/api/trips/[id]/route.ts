import { NextResponse } from "next/server";
import { storageAvailable } from "@/lib/kv";
import { loadTrip } from "@/lib/shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!storageAvailable) return NextResponse.json({ error: "Saved trips aren't switched on yet." }, { status: 503 });
  const { id } = await params;
  const trip = await loadTrip(id);
  if (!trip) return NextResponse.json({ error: "This trip link has expired or doesn't exist." }, { status: 404 });
  return NextResponse.json(trip);
}
