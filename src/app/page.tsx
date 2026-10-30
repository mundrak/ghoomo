"use client";

import { useEffect, useState } from "react";
import { ItineraryView, type PlanMeta } from "@/components/ItineraryView";
import { Logo } from "@/components/Logo";
import { Suggestions } from "@/components/Suggestions";
import { TripForm } from "@/components/TripForm";
import { secondaryButton, Spinner, textLink } from "@/components/ui";
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

const LOADING_LINES = ["checking fares from your city…", "comparing stays for your group…", "matching places to your interests…", "doing the budget maths…"];

function Loading({ title }: { title: string }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid place-items-center rounded-[28px] border-[1.5px] border-line bg-white px-6 py-24 text-center">
      <div className="text-orange">
        <Spinner />
      </div>
      <h2 className="mt-5 font-display text-2xl text-ink">{title}</h2>
      <p className="mt-1 font-hand text-2xl text-ink-soft">{LOADING_LINES[line]}</p>
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
  const onForm = !plan && !suggestions && !loadingSuggestions && !loadingDirectPlan;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b-[1.5px] border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button onClick={startOver} aria-label="ghoomo home">
            <Logo />
          </button>
          {!onForm && (
            <button onClick={startOver} className={`${secondaryButton} px-4 py-2 text-sm`}>
              New trip
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {onForm && (
          <div className="mb-10 max-w-3xl">
            <p className="inline-block -rotate-2 font-hand text-2xl text-orange">*checks bank balance first*</p>
            <h1 className="mt-2 font-display text-4xl leading-[1.02] tracking-tight text-ink sm:text-6xl">
              Tell us the budget.
              <br />
              We&apos;ll plan the trip.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Who&apos;s going and what you want to spend: that&apos;s all we need. You get places that fit, real prices, and a day-by-day plan.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold text-ink">
              <span className="-rotate-1 rounded-full bg-peach px-4 py-1.5">made for student groups</span>
              <span className="rotate-1 rounded-full bg-sage px-4 py-1.5">honest about prices</span>
              <span className="-rotate-[0.5deg] rounded-full bg-butter px-4 py-1.5">veg-friendly by default</span>
            </div>
          </div>
        )}

        {error && <div className="mb-6 rounded-2xl bg-peach px-5 py-4 text-ink">{error}</div>}

        {loadingSuggestions ? (
          <Loading title="Finding places that fit your budget" />
        ) : loadingDirectPlan ? (
          <Loading title="Planning your trip" />
        ) : plan && destination && input ? (
          <>
            <button onClick={() => setPlan(null)} className={`${textLink} mb-6 text-sm`}>
              ← {suggestions ? "Back to destinations" : "Edit trip details"}
            </button>
            <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={busy === "refine"} />
          </>
        ) : suggestions && input ? (
          <>
            <button onClick={() => setSuggestions(null)} className={`${textLink} mb-6 text-sm`}>
              ← Change trip details
            </button>
            <Suggestions input={input} suggestions={suggestions} onPick={(s) => planTrip(input, s.destination.id, s.flight)} busyId={busy ?? undefined} />
          </>
        ) : (
          <TripForm onSubmit={submit} busy={busy !== null} initial={input} />
        )}
      </main>

      <footer className="border-t-[1.5px] border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted sm:px-8">
          <p>
            A side project by{" "}
            <a href="https://mundrak.github.io" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-orange">
              khushi<span className="text-orange">.</span>
            </a>
          </p>
          <p>Prices marked &ldquo;estimate&rdquo; are approximate. Check before you book.</p>
        </div>
      </footer>
    </div>
  );
}
