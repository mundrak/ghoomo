"use client";

import { useEffect, useRef, useState } from "react";
import { ItineraryView, type PlanMeta } from "@/components/ItineraryView";
import { Logo } from "@/components/Logo";
import { Suggestions } from "@/components/Suggestions";
import { defaultTrip, TripForm } from "@/components/TripForm";
import { LocalName, textLink } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import type { Itinerary } from "@/lib/itinerary";
import type { Destination, FlightQuote, StayQuote, Suggestion, TripInput } from "@/lib/types";

interface Plan {
  destinationId: string;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  meta: PlanMeta;
}
type PlanResponse = Omit<Plan, "destinationId" | "meta"> & PlanMeta;

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

const toPlan = (destinationId: string, { itinerary, flight, stay, ...meta }: PlanResponse): Plan => ({
  destinationId,
  itinerary,
  flight,
  stay,
  meta,
});

const PLANNING_LINES = ["Checking fares from your city", "Comparing stays for your group", "Matching days to your interests", "Doing the budget maths"];

/** Shown while a plan is written. The logo's route draws itself from where you are to where you're going. */
function Planning({ d }: { d: Destination }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % PLANNING_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid place-items-center rounded-2xl bg-board px-6 py-24 text-center text-white" role="status">
      <svg width="132" height="60" viewBox="0 0 44 22" aria-hidden="true">
        <circle cx="6" cy="15" r="4" fill="#f4f4f1" />
        <path d="M13 11 Q22 0 32 7" stroke="var(--color-signal)" strokeWidth="2" strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1" className="animate-draw" />
        <circle cx="37" cy="8" r="3.6" stroke="#f4f4f1" strokeWidth="2" fill="none" />
      </svg>
      <LocalName d={d} className="mt-6 text-2xl text-signal" />
      <h2 className="font-wide mt-1 text-3xl font-bold">Planning {d.name}</h2>
      <p className="mt-2 text-board-soft">{PLANNING_LINES[line]}…</p>
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState<TripInput>(defaultTrip);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  // The board follows the form: refetch shortly after the last change.
  useEffect(() => {
    const ctrl = new AbortController();
    const wait = firstLoad.current ? 0 : 350;
    firstLoad.current = false;
    const t = setTimeout(async () => {
      setLoadingBoard(true);
      try {
        const res = await post<{ suggestions: Suggestion[] }>("/api/suggest", input, ctrl.signal);
        setSuggestions(res.suggestions);
        setError(null);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ctrl.signal.aborted) setLoadingBoard(false);
      }
    }, wait);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [input]);

  const pick = async (s: Suggestion) => {
    setPlanning(s.destination.id);
    setError(null);
    window.scrollTo({ top: 0 });
    try {
      const res = await post<PlanResponse>("/api/itinerary", { input, destinationId: s.destination.id, flight: s.flight });
      setPlan(toPlan(s.destination.id, res));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanning(null);
    }
  };

  const refine = async (change: string) => {
    if (!plan) return;
    const { destinationId, itinerary, flight, stay } = plan;
    setRefining(true);
    setError(null);
    try {
      const res = await post<PlanResponse>("/api/itinerary", { input, destinationId, itinerary, flight, stay, change });
      setPlan(toPlan(destinationId, res));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  const backToBoard = () => {
    setPlan(null);
    window.scrollTo({ top: 0 });
  };

  const destination = plan ? findDestination(plan.destinationId) : undefined;
  const planningDest = planning ? findDestination(planning) : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <button onClick={backToBoard} aria-label="ghoomo, back to the board">
            <Logo />
          </button>
          {plan && (
            <button onClick={backToBoard} className={`${textLink} text-sm`}>
              Back to the board
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {error && (
          <div role="alert" className="mb-6 rounded-xl border-[1.5px] border-short-ink/30 bg-white px-5 py-4 text-ink">
            {error}
          </div>
        )}

        {planningDest ? (
          <Planning d={planningDest} />
        ) : plan && destination ? (
          <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={refining} />
        ) : (
          <div className="space-y-12">
            <TripForm value={input} onChange={setInput} />
            <Suggestions input={input} suggestions={suggestions} loading={loadingBoard} onPick={pick} busyId={planning ?? undefined} />
          </div>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-soft sm:px-8">
          <p>
            A side project by{" "}
            <a href="https://mundrak.github.io" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
              khushi
            </a>
            .
          </p>
          <p>Prices marked &ldquo;estimate&rdquo; are approximate. Check before you book.</p>
        </div>
      </footer>
    </div>
  );
}
