"use client";

import { useEffect, useState } from "react";
import { findOrigin } from "@/data/airports";
import { CATEGORIES, CATEGORY_LABELS, inr, sumBudget } from "@/lib/budget";
import { cautionFor } from "@/lib/budget";
import { fareDateNote, travelMode } from "@/lib/travel";
import type { FlightQuote, Suggestion, TripInput } from "@/lib/types";
import { track } from "@/lib/track";
import { ABROAD_REGION_LABELS, ABROAD_REGIONS, nearness, ZONE_LABELS, ZONES, type AbroadRegion, type Zone } from "@/lib/zones";
import { IndiaMap } from "./IndiaMap";
import { Dot, LocalName, ModeIcon, PriceSource, primaryButton, rowClass, rowNote, rowsClass, Sec, Spinner, SplitBar, StatusPill, textLink } from "./ui";

const FIRST_ROWS = 8;

/** How you get there, in words and as an icon. */
export function gettingThere(q: FlightQuote) {
  const mode = travelMode(q);
  return { mode, label: q.label ?? (mode === "flight" ? "Flight" : "Getting there") };
}

function statusFor(spare: number) {
  if (spare < 0) return { fits: false, text: `${inr(-spare)} over` };
  if (spare < 100) return { fits: true, text: "right on budget" };
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
  return now ? <span className="font-mono text-xs tabular-nums text-soft">{now} IST</span> : null;
}

/** "22 of 38 places fit ₹18,600", with the time, in a pill under the headline. */
export function BoardStatus({ suggestions, budget, loading }: { suggestions: Suggestion[] | null; budget: number; loading: boolean }) {
  if (!suggestions) return <StatusPill live={false}>{loading ? "Checking where you can go…" : "Couldn't load places"}</StatusPill>;
  const fitting = suggestions.filter((s) => s.cost.total <= budget).length;
  return (
    <StatusPill live={!loading}>
      <span className="inline-flex flex-wrap items-baseline gap-x-2.5">
        <span>
          {loading ? "Updating…" : `${fitting} of ${suggestions.length} places fit ${inr(budget)}`}
        </span>
        <Clock />
      </span>
    </StatusPill>
  );
}

const filterLabel = (f: string, city: string) =>
  f === "all"
    ? "All"
    : f === "near"
      ? `Near ${city}`
      : f === "abroad"
        ? "All abroad"
        : f in ABROAD_REGION_LABELS
          ? ABROAD_REGION_LABELS[f as AbroadRegion]
          : ZONE_LABELS[f as Zone];

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
  const [hover, setHover] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Board filter: everything, places near the starting city, one zone, or abroad.
  const [zone, setZone] = useState<"all" | "near" | "abroad" | Zone | AbroadRegion>("all");
  const budget = sumBudget(input.budget);
  const origin = findOrigin(input.origin);
  const city = origin?.city ?? input.origin;

  const all = suggestions ?? [];
  const inFilter = (s: Suggestion, f: typeof zone) => {
    const z = s.destination.zone;
    if (f === "all") return true;
    if (f === "abroad") return s.destination.international;
    if ((ABROAD_REGIONS as readonly string[]).includes(f)) return s.destination.abroadRegion === f;
    if (f === "near") return Boolean(z && origin && nearness(origin.zone, z) === "same");
    return z === f;
  };
  const filters = (["all", "near", ...ZONES, "abroad", ...ABROAD_REGIONS] as const).filter((f) => f === "all" || all.some((s) => inFilter(s, f)));
  // If the current filter has nothing left (say, after switching to India only), fall back to everything.
  const active = filters.includes(zone) ? zone : "all";
  const rows = all.filter((s) => inFilter(s, active));
  const visible = showAll ? rows : rows.slice(0, FIRST_ROWS);
  // Costs don't depend on the budget, so fit is worked out here and updates the moment the slider moves.
  const fits = (s: Suggestion) => s.cost.total <= budget;
  const fitting = rows.filter(fits);

  // The map follows whatever you're looking at: the row under the pointer, then the open one, then the top pick.
  const focusId = hover ?? open ?? fitting[0]?.destination.id ?? null;
  const select = (id: string) => {
    if (!visible.some((s) => s.destination.id === id)) setShowAll(true);
    if (open !== id) track("pass_opened");
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const map = (labels: number) =>
    origin && (
      <>
        <IndiaMap
          origin={origin}
          places={rows.map((s) => ({ id: s.destination.id, name: s.destination.name, lat: s.destination.lat, lon: s.destination.lon, fits: fits(s) }))}
          activeId={focusId}
          labelIds={fitting.slice(0, labels).map((s) => s.destination.id)}
          onHover={setHover}
          onSelect={select}
          label={`Map of India showing ${city} and ${rows.length} places, ${fitting.length} within budget`}
        />
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink" /> fits
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-faint" /> over budget
          </span>
          <span>tap a dot to open it</span>
        </p>
      </>
    );

  return (
    <div className="flex flex-col gap-12">
      {/* On narrower screens the map sits above the list. On wide ones it moves beside it (below). */}
      {origin && (
        <Sec label="map" className="xl:hidden">
          <div className="max-w-[440px]">{map(4)}</div>
        </Sec>
      )}

      <div className="relative">
        {/* Wide screens: the map rides along in the margin, so hovering a row always shows its route. */}
        {origin && (
          <aside className="absolute left-full top-0 ml-12 hidden h-full w-[min(280px,calc(50vw-420px))] xl:block" aria-label="Map">
            <div className="sticky top-8">{map(0)}</div>
          </aside>
        )}
      <Sec label="places" id="places">
        {all.length > 0 && (
          <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by region">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={active === f}
                onClick={() => {
                  setZone(f);
                  setShowAll(false);
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-[13px] transition-colors ${active === f ? "bg-ink text-bg" : "bg-row text-soft hover:text-ink"}`}
              >
                {filterLabel(f, city)}
              </button>
            ))}
          </div>
        )}

        {!suggestions && !loading && <p className="py-2.5 text-soft">Couldn&apos;t load places. Change anything above to try again.</p>}
        {!suggestions && loading && <p className="py-2.5 text-soft">Checking where {inr(budget)} can take you…</p>}
        {suggestions && rows.length === 0 && (
          <p className="py-2.5 text-soft">No places match where you&apos;re looking. Try &ldquo;Anywhere&rdquo; in fine-tune.</p>
        )}

        <ul className={`${rowsClass} ${loading ? "opacity-60" : ""} transition-opacity`} onMouseLeave={() => setHover(null)}>
          {visible.map((s) => {
            const d = s.destination;
            const status = statusFor(budget - s.cost.total);
            const via = gettingThere(s.flight);
            const isOpen = open === d.id;
            return (
              <li key={d.id} id={`row-${d.id}`} className="scroll-mt-6">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`pass-${d.id}`}
                  onMouseEnter={() => setHover(d.id)}
                  onFocus={() => setHover(d.id)}
                  onClick={() => {
                    if (!isOpen) track("pass_opened");
                    setOpen(isOpen ? null : d.id);
                  }}
                  className={`${rowClass} w-full text-left hover:bg-row ${isOpen ? "bg-row" : ""}`}
                >
                  <span className={`flex min-w-0 flex-wrap items-baseline gap-x-2 ${status.fits ? "text-ink" : "text-faint"}`}>
                    <span className="font-medium">{d.name}</span>
                    <LocalName d={d} className="text-[13px] font-semibold text-faint" />
                    {d.international && d.country !== d.name && <span className="text-[13px] text-faint">{d.country}</span>}
                  </span>
                  <span className={`${rowNote} ${status.fits ? "text-ink" : ""}`}>{inr(s.cost.total)}</span>
                  <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-soft">
                    <ModeIcon mode={via.mode} className="shrink-0 text-faint" />
                    <span>{via.label}</span>
                    <span className="text-faint">·</span>
                    <span className={status.fits ? "text-soft" : "text-faint"}>{status.text}</span>
                    {cautionFor(d, input.startDate) && (
                      <>
                        <span className="text-faint">·</span>
                        <span className="text-faint">off season</span>
                      </>
                    )}
                  </span>
                </button>
                {isOpen && <Pass id={`pass-${d.id}`} s={s} input={input} city={city} budget={budget} onPick={onPick} busyId={busyId} />}
              </li>
            );
          })}
        </ul>

        {rows.length > FIRST_ROWS && (
          <button type="button" onClick={() => setShowAll(!showAll)} className={`${textLink} mt-3 text-sm`}>
            {showAll ? "Show fewer" : `Show all ${rows.length} places`}
          </button>
        )}
      </Sec>
      </div>
    </div>
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

  const notes = [
    ...reasons,
    via.mode === "flight" && d.arrivalNote ? d.arrivalNote : null,
    (via.mode === "train" || via.mode === "bus") && d.ground && d.ground.to !== d.name
      ? `The ${via.mode} goes to ${d.ground.to}. Get a cab or local transport on to ${d.name}.`
      : null,
    d.international ? `Visa for Indian passports: ${d.visa}. Check the rules before you book.` : null,
  ].filter((n): n is string => Boolean(n));

  return (
    <div id={id} className="animate-open mx-3 mb-3 mt-1 flex flex-col gap-5 border-l border-line py-2 pl-5">
      <div className="flex items-center gap-3 font-medium">
        <span>{city}</span>
        <span className="h-0 max-w-24 flex-1 border-t border-dashed border-faint" />
        <ModeIcon mode={via.mode} className="shrink-0 text-faint" />
        <span className="h-0 max-w-24 flex-1 border-t border-dashed border-faint" />
        <span>{via.mode === "train" || via.mode === "bus" ? (d.ground?.to ?? d.name) : d.name}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {[
          ["leaving", leaving],
          ["trip", `${input.days} days`],
          ["travellers", input.travellers === 1 ? "Just you" : `${input.travellers} people`],
          ["getting there", via.label],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[11px] text-faint">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2.5">
        <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: s.cost[c] }))} />
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
          {CATEGORIES.map((c) => (
            <li key={c} className="inline-flex items-center gap-1.5">
              <Dot category={c} />
              {CATEGORY_LABELS[c]} <span className="tabular-nums text-ink">{inr(s.cost[c])}</span>
              {c === "flights" && via.mode !== "none" && <PriceSource kind="travel" live={s.flight.source === "live"} />}
            </li>
          ))}
        </ul>
        {fareNote && <p className="text-sm text-faint">{fareNote}</p>}
      </div>

      {caution && (
        <p className="text-sm">
          <span className="font-mono text-xs text-faint">heads up · </span>
          {caution}
        </p>
      )}

      {notes.length > 0 && (
        <ul className="space-y-1 text-sm text-soft">
          {notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="text-faint">–</span>
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{inr(s.cost.total)}</span>
          <span className="ml-2 text-sm text-soft">
            per person{spare >= 100 ? `, ${inr(spare)} under` : spare >= 0 ? ", right on budget" : `, ${inr(-spare)} over`}
          </span>
          {input.travellers > 1 && <span className="block font-mono text-xs text-faint">{inr(s.cost.total * input.travellers)} for the group</span>}
        </div>
        <button type="button" onClick={() => onPick(s)} disabled={Boolean(busyId)} className={primaryButton}>
          {busyId === d.id ? (
            <>
              <Spinner /> Planning
            </>
          ) : (
            "Plan this trip →"
          )}
        </button>
      </div>
    </div>
  );
}
