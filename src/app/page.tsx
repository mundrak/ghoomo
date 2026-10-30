"use client";

import { useEffect, useState } from "react";
import { ItineraryView, type PlanMeta } from "@/components/ItineraryView";
import { Suggestions } from "@/components/Suggestions";
import { TripForm } from "@/components/TripForm";
import { Spinner } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import type { Itinerary } from "@/lib/itinerary";
import type { FlightQuote, StayQuote, Suggestion, TripInput } from "@/lib/types";

interface Plan {
  destinationId: string;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  meta: PlanMeta;
}
type PlanResponse = Omit<Plan, "destinationId" | "meta"> & PlanMeta;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

const toPlan = (destinationId: string, { itinerary, flight, stay, ...meta }: PlanResponse): Plan => ({
  destinationId,
  itinerary,
  flight,
  stay,
  meta,
});

const LOADING_LINES = ["Checking fares from your city…", "Comparing stays for your group…", "Matching places to your interests…", "Doing the budget maths…"];

function Loading({ title }: { title: string }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid place-items-center rounded-3xl border border-stone-200 bg-white px-6 py-20 text-center shadow-sm">
      <div className="text-teal-600">
        <Spinner />
      </div>
      <h2 className="mt-4 text-xl font-bold text-stone-900">{title}</h2>
      <p className="mt-1 text-stone-500">{LOADING_LINES[line]}</p>
    </div>
  );
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const planTrip = (tripInput: TripInput, destinationId: string, flight?: FlightQuote) =>
    run(destinationId, async () => {
      const res = await post<PlanResponse>("/api/itinerary", { input: tripInput, destinationId, flight });
      setPlan(toPlan(destinationId, res));
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
    const { destinationId, itinerary, flight, stay } = plan;
    run("refine", async () => {
      const res = await post<PlanResponse>("/api/itinerary", { input, destinationId, itinerary, flight, stay, change });
      setPlan(toPlan(destinationId, res));
    });
  };

  const startOver = () => {
    setPlan(null);
    setSuggestions(null);
    setInput(null);
  };

  const destination = plan && findDestination(plan.destinationId);
  const loadingSuggestions = busy === "form";
  const loadingDirectPlan = busy !== null && busy !== "refine" && !suggestions && input?.destinationId === busy;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button onClick={startOver} className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-teal-700">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-lg text-white">🧭</span>
            ghoomo
          </button>
          {(plan || suggestions) && (
            <button onClick={startOver} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-400">
              New trip
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {!plan && !suggestions && !loadingSuggestions && !loadingDirectPlan && (
          <div className="mb-8 max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
              Your budget decides. <span className="text-teal-600">We plan the trip.</span>
            </h1>
            <p className="mt-3 text-lg text-stone-600">Tell us who&apos;s going and what you want to spend. We&apos;ll show you where you can go and plan every day of it.</p>
          </div>
        )}

        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}

        {loadingSuggestions ? (
          <Loading title="Finding places that fit your budget" />
        ) : loadingDirectPlan ? (
          <Loading title="Planning your trip" />
        ) : plan && destination && input ? (
          <>
            <button onClick={() => setPlan(null)} className="mb-4 text-sm font-medium text-teal-700 hover:underline">
              ← {suggestions ? "Back to destinations" : "Edit trip details"}
            </button>
            <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={busy === "refine"} />
          </>
        ) : suggestions && input ? (
          <>
            <button onClick={() => setSuggestions(null)} className="mb-4 text-sm font-medium text-teal-700 hover:underline">
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
          <TripForm onSubmit={submit} busy={busy !== null} initial={input} />
        )}
      </main>
    </div>
  );
}
