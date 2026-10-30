"use client";

import { useState } from "react";
import { ItineraryView } from "@/components/ItineraryView";
import { Suggestions } from "@/components/Suggestions";
import { TripForm } from "@/components/TripForm";
import { findDestination } from "@/data/destinations";
import type { Itinerary } from "@/lib/itinerary";
import type { FlightQuote, StayQuote, Suggestion, TripInput } from "@/lib/types";

interface Plan {
  destinationId: string;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  ai: boolean;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

export default function Home() {
  const [input, setInput] = useState<TripInput | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const planTrip = (tripInput: TripInput, destinationId: string, flight?: FlightQuote) =>
    run(destinationId, async () => {
      const res = await post<Omit<Plan, "destinationId">>("/api/itinerary", { input: tripInput, destinationId, flight });
      setPlan({ destinationId, ...res });
    });

  const submit = (tripInput: TripInput) => {
    setInput(tripInput);
    setPlan(null);
    setSuggestions(null);
    if (tripInput.destinationId) return planTrip(tripInput, tripInput.destinationId);
    run("form", async () => {
      const res = await post<{ suggestions: Suggestion[] }>("/api/suggest", tripInput);
      setSuggestions(res.suggestions);
    });
  };

  const refine = (change: string) => {
    if (!plan || !input) return;
    run("refine", async () => {
      const res = await post<Omit<Plan, "destinationId">>("/api/itinerary", { input, ...plan, change });
      setPlan({ ...plan, ...res });
    });
  };

  const startOver = () => {
    setPlan(null);
    setSuggestions(null);
  };

  const destination = plan && findDestination(plan.destinationId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <button onClick={startOver} className="text-2xl font-bold tracking-tight text-teal-800">
          ghoomo
        </button>
        <p className="mt-1 text-stone-600">Tell us your budget. We&apos;ll tell you where to go and plan the whole trip.</p>
      </header>

      {error && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}

      {plan && destination && input ? (
        <>
          <button onClick={() => setPlan(null)} className="mb-4 text-sm text-teal-700 underline">
            ← {suggestions ? "Back to destinations" : "Back"}
          </button>
          <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={busy === "refine"} />
        </>
      ) : suggestions && input ? (
        <>
          <button onClick={() => setSuggestions(null)} className="mb-4 text-sm text-teal-700 underline">
            ← Change trip details
          </button>
          <Suggestions
            input={input}
            suggestions={suggestions}
            onPick={(s) => planTrip(input, s.destination.id, s.flight)}
            busyId={busy ?? undefined}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white/70 p-5 sm:p-8">
          <TripForm onSubmit={submit} busy={busy !== null} />
        </div>
      )}
    </main>
  );
}
