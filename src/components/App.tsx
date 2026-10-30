"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GroupCheckin } from "@/components/GroupCheckin";
import { ItineraryView, type PlanMeta } from "@/components/ItineraryView";
import { Logo } from "@/components/Logo";
import { Suggestions } from "@/components/Suggestions";
import { defaultTrip, TripForm } from "@/components/TripForm";
import { LocalName, textLink } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { scaleBudget, scoreDestination } from "@/lib/budget";
import { track } from "@/lib/track";
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

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

interface SavedTripResponse {
  input: TripInput;
  destinationId: string;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  meta: PlanMeta;
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

const FORM_KEY = "ghoomo:form";

/** Reads ?trip= and ?group= from the address bar. */
const linkParam = (name: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name));

/** Keeps the address bar in step with what's on screen, so refreshing or copying the URL works. */
function setLink(params: { trip?: string | null; group?: string | null }) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}

export function App({ storage }: { storage: boolean }) {
  const [input, setInput] = useState<TripInput>(defaultTrip);
  const [hydrated, setHydrated] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);
  const boardCounted = useRef(false);
  const latestInput = useRef(input);

  // On first load: open a shared trip (?trip=), join a group (?group=), or pick up the form where it was left.
  useEffect(() => {
    const trip = linkParam("trip");
    const group = linkParam("group");
    if (group && storage) setGroupId(group);
    (async () => {
      if (trip && storage) {
        try {
          const saved = await get<SavedTripResponse>(`/api/trips/${encodeURIComponent(trip)}`);
          setInput(saved.input);
          setPlan({ destinationId: saved.destinationId, itinerary: saved.itinerary, flight: saved.flight, stay: saved.stay, meta: saved.meta });
          setTripId(trip);
          track("trip_link_opened");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setLink({ trip: null });
        }
      } else {
        try {
          const kept = JSON.parse(localStorage.getItem(FORM_KEY) ?? "null") as TripInput | null;
          const today = new Date().toISOString().slice(0, 10);
          if (kept?.budget && kept.origin) setInput({ ...kept, startDate: kept.startDate >= today ? kept.startDate : defaultTrip().startDate });
        } catch {
          // No saved form, or storage is blocked: start fresh.
        }
      }
      setHydrated(true);
    })();
  }, [storage]);

  // Remember the form in this browser, so a refresh doesn't lose it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(input));
    } catch {
      // Private browsing or storage full: nothing to do.
    }
  }, [input, hydrated]);
  useEffect(() => {
    latestInput.current = input;
  });

  // Costs and fares don't depend on the budget, so only refetch when something else changes.
  // Moving the budget slider re-ranks the board in the browser instead (see `ranked`).
  const fetchKey = JSON.stringify({ ...input, budget: undefined });

  // The board follows the form: refetch shortly after the last change.
  useEffect(() => {
    if (!hydrated) return;
    const ctrl = new AbortController();
    const wait = firstLoad.current ? 0 : 350;
    firstLoad.current = false;
    const t = setTimeout(async () => {
      setLoadingBoard(true);
      try {
        const res = await post<{ suggestions: Suggestion[] }>("/api/suggest", latestInput.current, ctrl.signal);
        if (!boardCounted.current) {
          boardCounted.current = true;
          track("board_shown");
        }
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
  }, [fetchKey, hydrated]);

  const ranked = useMemo(
    () =>
      suggestions
        ?.map((s) => ({ ...s, ...scoreDestination(s.destination, input, s.cost) }))
        .sort((x, y) => y.fitScore - x.fitScore) ?? null,
    [suggestions, input],
  );

  /** Saves the plan on screen so the address bar becomes a link anyone can open. */
  const save = async (p: Plan, forInput: TripInput) => {
    if (!storage) return;
    try {
      const { id } = await post<{ id: string }>("/api/trips", { input: forInput, destinationId: p.destinationId, itinerary: p.itinerary, flight: p.flight, stay: p.stay, meta: { ai: p.meta.ai, aiAvailable: p.meta.aiAvailable } });
      setTripId(id);
      setLink({ trip: id });
    } catch {
      // The plan still works; it just won't have a link.
      setTripId(null);
    }
  };

  const applyGroupBudget = (lowest: number, size: number) => {
    track("group_budget_used");
    setInput((prev) => ({
      ...prev,
      travellers: size,
      party: size === 2 && prev.party === "couple" ? "couple" : prev.party === "solo" || prev.party === "couple" ? "group" : prev.party,
      budget: scaleBudget(prev.budget, lowest),
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pick = async (s: Suggestion) => {
    setPlanning(s.destination.id);
    setError(null);
    track("plan_requested");
    window.scrollTo({ top: 0 });
    try {
      const res = await post<PlanResponse>("/api/itinerary", { input, destinationId: s.destination.id, flight: s.flight });
      const next = toPlan(s.destination.id, res);
      setPlan(next);
      track("plan_shown");
      void save(next, input);
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
      const next = toPlan(destinationId, res);
      setPlan(next);
      void save(next, input);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  };

  const backToBoard = () => {
    setPlan(null);
    setTripId(null);
    setLink({ trip: null });
    window.scrollTo({ top: 0 });
  };

  const openGroup = (id: string | null) => {
    setGroupId(id);
    setLink({ group: id });
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const shareUrl = tripId ? `${origin}/?trip=${tripId}` : null;

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
          <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={refining} shareUrl={shareUrl} siteUrl={origin} />
        ) : (
          <div className="space-y-12">
            <TripForm value={input} onChange={setInput} />
            <Suggestions input={input} suggestions={ranked} loading={loadingBoard} onPick={pick} busyId={planning ?? undefined} />
            {storage && <GroupCheckin groupId={groupId} onGroup={openGroup} travellers={input.travellers} onUse={applyGroupBudget} />}
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
          <p className="w-full text-xs">
            ghoomo counts visits and clicks anonymously and keeps one cookie to share free AI plans fairly. No accounts, no personal details.
          </p>
        </div>
      </footer>
    </div>
  );
}
