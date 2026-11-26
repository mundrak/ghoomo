"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GroupCheckin } from "@/components/GroupCheckin";
import { ItineraryView, type PlanMeta } from "@/components/ItineraryView";
import { Logo } from "@/components/Logo";
import { IndiaMap } from "@/components/IndiaMap";
import { BoardStatus, Suggestions } from "@/components/Suggestions";
import { defaultTrip, TripForm } from "@/components/TripForm";
import { LocalName, StatusPill, textLink, ThemeToggle } from "@/components/ui";
import { findOrigin } from "@/data/airports";
import { findDestination } from "@/data/destinations";
import { scaleBudget, scoreDestination, sumBudget } from "@/lib/budget";
import { track } from "@/lib/track";
import type { Itinerary, Outline } from "@/lib/itinerary";
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

interface StreamHandlers {
  /** The outline is ready: show the plan page now, with the days still being written. */
  outline: (o: { outline: Outline; flight: FlightQuote; stay: StayQuote; premium: boolean }) => void;
  /** One day is ready. */
  day: (day: Itinerary["days"][number]) => void;
}

/**
 * Asks for a new plan as a stream: the outline arrives in a few seconds, then each day as it's written.
 * Cached plans, starter plans and errors come back as ordinary JSON, which is handled too.
 */
async function postPlan(body: unknown, on: StreamHandlers): Promise<PlanResponse> {
  const res = await fetch("/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson, application/json" },
    body: JSON.stringify(body),
  });
  if (!res.headers.get("content-type")?.includes("ndjson") || !res.body) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
    return data as PlanResponse;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { outline?: Parameters<StreamHandlers["outline"]>[0]; day?: Itinerary["days"][number]; done?: PlanResponse };
      if (msg.done) return msg.done;
      if (msg.outline) on.outline(msg.outline);
      if (msg.day) on.day(msg.day);
    }
  }
  throw new Error("The connection dropped while your plan was being written. Try again.");
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

/** Shown until the plan's outline arrives: the route draws itself on the map, from where you are to where you're going. */
function Planning({ d, from }: { d: Destination; from: { lat: number; lon: number; city: string } | undefined }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % PLANNING_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col gap-10" role="status">
      <header className="flex flex-col gap-3.5">
        <LocalName d={d} className="text-lg text-faint" />
        <h1 className="text-[clamp(32px,7vw,48px)] font-semibold leading-[1.05] tracking-[-0.035em]">Planning {d.name}</h1>
        <StatusPill>{PLANNING_LINES[line]}…</StatusPill>
      </header>
      {from && (
        <div className="max-w-[360px]">
          <IndiaMap origin={from} places={[{ id: d.id, name: d.name, lat: d.lat, lon: d.lon, fits: true }]} activeId={d.id} drawing label={`Route from ${from.city} to ${d.name}`} />
        </div>
      )}
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
  // Which plan request is current, so a stream from a plan the user has left can't bring it back.
  const request = useRef(0);
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
        .sort((x, y) => y.fitScore - x.fitScore || x.cost.total - y.cost.total) ?? null,
    [suggestions, input],
  );

  /** Saves the plan on screen so the address bar becomes a link anyone can open. */
  const save = async (p: Plan, forInput: TripInput) => {
    if (!storage) return;
    try {
      const { id } = await post<{ id: string }>("/api/trips", { input: forInput, destinationId: p.destinationId, itinerary: p.itinerary, flight: p.flight, stay: p.stay, meta: { ai: p.meta.ai, premium: p.meta.premium, aiAvailable: p.meta.aiAvailable } });
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
    const id = ++request.current;
    const destinationId = s.destination.id;
    try {
      const res = await postPlan(
        { input, destinationId, flight: s.flight },
        {
          outline: ({ outline, flight, stay, premium }) => {
            if (request.current !== id) return;
            const { days, ...rest } = outline;
            setPlan({
              destinationId,
              itinerary: { ...rest, days: days.map(({ day, title }) => ({ day, title, items: [] })) },
              flight,
              stay,
              meta: { ai: true, premium, aiAvailable: true, pending: Object.fromEntries(days.map((d) => [d.day, d.plan])) },
            });
            setPlanning(null);
          },
          day: (day) => {
            if (request.current !== id) return;
            setPlan((p) => {
              if (!p || p.destinationId !== destinationId) return p;
              const pending = { ...p.meta.pending };
              delete pending[day.day];
              return {
                ...p,
                itinerary: { ...p.itinerary, days: p.itinerary.days.map((d) => (d.day === day.day ? day : d)) },
                meta: { ...p.meta, pending },
              };
            });
          },
        },
      );
      if (request.current !== id) return;
      const next = toPlan(s.destination.id, res);
      setPlan(next);
      track("plan_shown");
      void save(next, input);
    } catch (e) {
      if (request.current !== id) return;
      // Don't leave a half-written plan on screen.
      setPlan((p) => (p?.meta.pending && Object.keys(p.meta.pending).length ? null : p));
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
    request.current++;
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
    // One calm column on phones and tablets (like the portfolio's focus page); on larger screens the
    // page spreads into columns, with the controls and the map pinned while the list scrolls.
    <div className="mx-auto flex min-h-screen w-full max-w-[720px] flex-col gap-12 px-5 pb-12 pt-[clamp(24px,5vh,48px)] sm:px-6 lg:max-w-[1480px] lg:px-10">
      <div className="flex items-center justify-between gap-3">
        <button onClick={backToBoard} aria-label="ghoomo, back to the start">
          <Logo />
        </button>
        <div className="flex items-center gap-2">
          {plan && (
            <button onClick={backToBoard} className="rounded-full bg-row px-3.5 text-[13px] font-medium leading-[34px] text-soft transition-colors hover:text-ink">
              ← all places
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>

      <main className="flex-1">
        {error && (
          <div role="alert" className="mb-10 rounded-[10px] bg-row px-4 py-3 text-ink">
            {error}
          </div>
        )}

        {planningDest ? (
          <div className="mx-auto max-w-[720px] @container">
            <Planning d={planningDest} from={findOrigin(input.origin)} />
          </div>
        ) : plan && destination ? (
          <ItineraryView input={input} destination={destination} {...plan} onChange={refine} busy={refining} shareUrl={shareUrl} siteUrl={origin} />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:gap-16">
            {/* The trip and budget stay in view (scrolling on their own if fine-tune is open) while the places scroll. */}
            <div className="@container lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:pb-6 lg:[scrollbar-width:thin]">
              <TripForm value={input} onChange={setInput} status={<BoardStatus suggestions={ranked} budget={sumBudget(input.budget)} loading={loadingBoard} />} />
            </div>
            <div className="flex min-w-0 flex-col gap-12">
              <Suggestions input={input} suggestions={ranked} loading={loadingBoard} onPick={pick} busyId={planning ?? undefined} />
              {storage && (
                <div className="@container">
                  <GroupCheckin groupId={groupId} onGroup={openGroup} travellers={input.travellers} onUse={applyGroupBudget} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="flex flex-col gap-2 border-t border-line pt-5 text-[13px] text-faint">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <span>
            A side project by{" "}
            <a href="https://mundrak.github.io/focus/" target="_blank" rel="noopener noreferrer" className="text-soft transition-colors hover:text-ink">
              khushi
            </a>
            .
          </span>
          <span>Prices marked &ldquo;estimate&rdquo; are approximate. Check before you book.</span>
        </div>
        <p className="text-xs">
          ghoomo counts visits and clicks anonymously and keeps one cookie to share free AI plans fairly. No accounts, no personal details. Map
          outline from{" "}
          <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noopener noreferrer" className={textLink}>
            svg-maps
          </a>{" "}
          by Victor Cazanave, CC BY 4.0, simplified.
        </p>
      </footer>
    </div>
  );
}
