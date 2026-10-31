"use client";

import { useEffect, useRef, useState } from "react";
import { findOrigin } from "@/data/airports";
import { CATEGORIES, CATEGORY_LABELS, inr, sumBudget } from "@/lib/budget";
import { cautionFor } from "@/lib/budget";
import { fareDateNote, travelMode } from "@/lib/travel";
import type { FlightQuote, Suggestion, TripInput } from "@/lib/types";
import { track } from "@/lib/track";
import { nearness, ZONE_LABELS, ZONES, type Zone } from "@/lib/zones";
import { Dot, LocalName, ModeIcon, PriceSource, primaryButton, Spinner, SplitBar } from "./ui";

const FIRST_ROWS = 8;

/** How you get there, in words and as an icon. */
export function gettingThere(q: FlightQuote) {
  const mode = travelMode(q);
  return { mode, label: q.label ?? (mode === "flight" ? "Flight" : "Getting there") };
}

function statusFor(spare: number) {
  if (spare < 0) return { fits: false, text: `${inr(-spare)} short` };
  if (spare < 100) return { fits: true, text: "Right on budget" };
  return { fits: true, text: `${inr(spare)} spare` };
}

function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return now ? <span className="tabular-nums">{now} IST</span> : null;
}

export function Suggestions({
  input,
  suggestions,
  loading,
  onPick,
  busyId,
}: {
  input: TripInput;
  suggestions: Suggestion[] | null;
  loading: boolean;
  onPick: (s: Suggestion) => void;
  busyId?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Board filter: everything, places near the starting city, one zone, or abroad.
  const [zone, setZone] = useState<"all" | "near" | "abroad" | Zone>("all");
  // Remember which rows fitted last time, so a status that changes can flip like a departures board.
  const prevFit = useRef<Record<string, boolean>>({});
  const budget = sumBudget(input.budget);
  const origin = findOrigin(input.origin);
  const city = origin?.city ?? input.origin;

  const all = suggestions ?? [];
  const inFilter = (s: Suggestion, f: typeof zone) => {
    const z = s.destination.zone;
    if (f === "all") return true;
    if (f === "abroad") return s.destination.international;
    if (f === "near") return Boolean(z && origin && nearness(origin.zone, z) === "same");
    return z === f;
  };
  const filters = (["all", "near", ...ZONES, "abroad"] as const).filter((f) => f === "all" || all.some((s) => inFilter(s, f)));
  // If the current filter has nothing left (say, after switching to India only), fall back to everything.
  const active = filters.includes(zone) ? zone : "all";
  const rows = all.filter((s) => inFilter(s, active));
  const visible = showAll ? rows : rows.slice(0, FIRST_ROWS);
  // Costs don't depend on the budget, so fit is worked out here and updates the moment the slider moves.
  const fits = (s: Suggestion) => s.cost.total <= budget;
  const fitting = rows.filter(fits).length;

  const changed: Record<string, boolean> = {};
  for (const s of rows) {
    const before = prevFit.current[s.destination.id];
    changed[s.destination.id] = before !== undefined && before !== fits(s);
  }
  useEffect(() => {
    for (const s of rows) prevFit.current[s.destination.id] = s.cost.total <= budget;
  });

  return (
    <section aria-labelledby="board-title" className="overflow-hidden rounded-2xl bg-board text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pb-4 pt-5 sm:px-7">
        <h2 id="board-title" className="font-wide text-2xl font-bold">
          Departures from <span className="text-signal">{city}</span>
        </h2>
        <p className="text-sm text-board-soft" aria-live="polite">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Updating
            </span>
          ) : suggestions ? (
            <>
              {fitting} of {rows.length} fit {inr(budget)}. Best matches first. <Clock />
            </>
          ) : null}
        </p>
      </div>

      {all.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4 sm:px-7" role="group" aria-label="Filter by region">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={active === f}
              onClick={() => {
                setZone(f);
                setShowAll(false);
              }}
              className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition ${
                active === f ? "border-signal bg-signal text-ink" : "border-board-line text-board-soft hover:border-board-soft hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f === "near" ? `Near ${city}` : f === "abroad" ? "Abroad" : ZONE_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      <div
        className="hidden grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-board-line px-7 pb-2.5 text-[13px] text-board-soft md:grid"
        aria-hidden="true"
      >
        <span>Destination</span>
        <span>Getting there</span>
        <span>Per person, all in</span>
        <span>Status</span>
      </div>

      {!suggestions && !loading && <p className="px-7 py-10 text-board-soft">Couldn&apos;t load places. Change anything above to try again.</p>}
      {!suggestions && loading && <p className="px-7 py-10 text-board-soft">Checking where {inr(budget)} can take you…</p>}
      {suggestions && rows.length === 0 && (
        <p className="px-7 py-10 text-board-soft">No places match where you&apos;re looking. Try &ldquo;Anywhere&rdquo; in Fine-tune.</p>
      )}

      <ul className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}>
        {visible.map((s) => {
          const d = s.destination;
          const status = statusFor(budget - s.cost.total);
          const via = gettingThere(s.flight);
          const isOpen = open === d.id;
          return (
            <li key={d.id} className="border-b border-board-line last:border-b-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`pass-${d.id}`}
                onClick={() => {
                  if (!isOpen) track("pass_opened");
                  setOpen(isOpen ? null : d.id);
                }}
                className={`grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3.5 text-left transition hover:bg-board-raised md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:px-7 ${
                  isOpen ? "bg-board-raised" : ""
                }`}
              >
                <span className={`flex flex-wrap items-baseline gap-x-3 ${status.fits ? "" : "opacity-60"}`}>
                  <LocalName d={d} className="text-[21px] leading-snug text-signal" />
                  <span className="font-wide text-lg font-bold">{d.name}</span>
                  {d.international && d.country !== d.name && <span className="text-sm text-board-soft">{d.country}</span>}
                  {d.zone && <span className="text-sm text-board-soft">{ZONE_LABELS[d.zone]}</span>}
                  {cautionFor(d, input.startDate) && <span className="text-sm font-semibold text-short">Off season</span>}
                </span>
                <span className={`order-3 flex items-center gap-2 text-[15px] text-[#d6dde7] md:order-none ${status.fits ? "" : "opacity-60"}`}>
                  <ModeIcon mode={via.mode} className="shrink-0" />
                  {via.label}
                </span>
                <span className={`text-right text-lg font-bold tabular-nums md:text-left ${status.fits ? "" : "opacity-60"}`}>{inr(s.cost.total)}</span>
                <span
                  className={`order-4 justify-self-end font-semibold [perspective:300px] md:order-none md:justify-self-start ${
                    status.fits ? "text-go" : "text-short"
                  }`}
                >
                  <span key={`${d.id}-${status.fits}`} className={`inline-flex items-center gap-2 ${changed[d.id] ? "animate-flip" : ""}`}>
                    <span className={`h-2 w-2 rounded-full ${status.fits ? "bg-go" : "bg-short"}`} />
                    {status.text}
                  </span>
                </span>
              </button>
              {isOpen && <Pass id={`pass-${d.id}`} s={s} input={input} city={city} budget={budget} onPick={onPick} busyId={busyId} />}
            </li>
          );
        })}
      </ul>

      {rows.length > FIRST_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full border-t border-board-line px-7 py-3.5 text-left text-sm font-semibold text-board-soft hover:bg-board-raised hover:text-white"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} places`}
        </button>
      )}
    </section>
  );
}

function Pass({
  id,
  s,
  input,
  city,
  budget,
  onPick,
  busyId,
}: {
  id: string;
  s: Suggestion;
  input: TripInput;
  city: string;
  budget: number;
  onPick: (s: Suggestion) => void;
  busyId?: string;
}) {
  const d = s.destination;
  const spare = budget - s.cost.total;
  const via = gettingThere(s.flight);
  const leaving = new Date(`${input.startDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  // The budget line is already on the board, so keep the other reasons.
  const reasons = s.reasons.filter((r) => !r.startsWith("Fits your budget"));
  const caution = cautionFor(d, input.startDate);
  const fareNote = fareDateNote(s.flight, input.startDate);

  return (
    <div id={id} className="animate-open mx-3 mb-4 mt-1 grid overflow-hidden rounded-xl bg-paper text-ink md:mx-7 md:grid-cols-[minmax(0,1fr)_250px]">
      <div className="p-5 sm:p-6">
        <div className="font-wide flex items-center gap-3 text-xl font-extrabold sm:text-2xl">
          <span>{city}</span>
          <span className="h-0 max-w-28 flex-1 border-t-2 border-dashed border-soft/60" />
          <ModeIcon mode={via.mode} className="shrink-0 text-soft" />
          <span className="h-0 max-w-28 flex-1 border-t-2 border-dashed border-soft/60" />
          <span>{via.mode === "train" || via.mode === "bus" ? (d.ground?.to ?? d.name) : d.name}</span>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-sm">
          {[
            ["Leaving", leaving],
            ["Trip", `${input.days} days`],
            ["Travellers", input.travellers === 1 ? "Just you" : `${input.travellers} people`],
            ["Getting there", via.label],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-soft">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 space-y-2.5">
          <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: s.cost[c] }))} />
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
            {CATEGORIES.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <Dot category={c} />
                {CATEGORY_LABELS[c]} <span className="font-semibold tabular-nums text-ink">{inr(s.cost[c])}</span>
                {c === "flights" && via.mode !== "none" && <PriceSource kind="travel" live={s.flight.source === "live"} />}
              </li>
            ))}
          </ul>
        </div>

        {fareNote && <p className="mt-2 text-sm text-soft">{fareNote}</p>}

        {caution && (
          <p className="mt-5 rounded-lg border-l-4 border-short-ink bg-white px-4 py-2.5 text-[15px]">
            <span className="font-semibold">Heads up for your dates:</span> {caution}
          </p>
        )}

        <ul className="mt-5 space-y-1.5 text-[15px]">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              {r}
            </li>
          ))}
          {via.mode === "flight" && d.arrivalNote && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              {d.arrivalNote}
            </li>
          )}
          {(via.mode === "train" || via.mode === "bus") && d.ground && d.ground.to !== d.name && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              The {via.mode} goes to {d.ground.to}. Get a cab or local transport on to {d.name}.
            </li>
          )}
          {d.international && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              Visa for Indian passports: {d.visa}. Check the rules before you book.
            </li>
          )}
        </ul>
      </div>

      <div className="relative flex flex-col gap-1.5 border-t-2 border-dashed border-line bg-white p-5 sm:p-6 md:border-l-2 md:border-t-0">
        <span className="absolute -left-[11px] -top-[11px] hidden h-5 w-5 rounded-full bg-board-raised md:block" />
        <span className="absolute -bottom-[11px] -left-[11px] hidden h-5 w-5 rounded-full bg-board-raised md:block" />
        <span className="text-sm text-soft">Per person, all in</span>
        <span className="text-[32px] font-extrabold leading-none tabular-nums">{inr(s.cost.total)}</span>
        <span className={`text-sm font-semibold ${spare >= 0 ? "text-go-ink" : "text-short-ink"}`}>
          {spare >= 100 ? `${inr(spare)} under budget` : spare >= 0 ? "Right on budget" : `${inr(-spare)} over your budget`}
        </span>
        {input.travellers > 1 && <span className="text-sm text-soft">{inr(s.cost.total * input.travellers)} for the group</span>}
        <button type="button" onClick={() => onPick(s)} disabled={Boolean(busyId)} className={`${primaryButton} mt-4 md:mt-auto`}>
          {busyId === d.id ? (
            <>
              <Spinner /> Planning
            </>
          ) : (
            "Plan this trip"
          )}
        </button>
      </div>
    </div>
  );
}
