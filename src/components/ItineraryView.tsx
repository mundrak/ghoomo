"use client";

import { useState } from "react";
import { findOrigin, ORIGIN_AIRPORTS } from "@/data/airports";
import { cautionFor, CATEGORIES, CATEGORY_LABELS, inr, TIER_INFO } from "@/lib/budget";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, Destination, FlightQuote, StayQuote, TripInput } from "@/lib/types";
import { fareDateNote, travelMode } from "@/lib/travel";
import { track } from "@/lib/track";
import type { FeedbackReason } from "@/lib/events";
import { CopyButton, WhatsAppLink } from "./Share";
import { IndiaMap } from "./IndiaMap";
import { Dot, inputClass, LocalName, Meter, ModeIcon, PriceSource, primaryButton, rowClass, rowNote, rowsClass, Sec, secondaryButton, Spinner, StatusPill } from "./ui";

const QUICK_CHANGES = ["Make it cheaper", "More nightlife", "More veg food spots", "Slower pace", "Add one splurge"];
const MAX_CHANGE_CHARS = 300;

export interface PlanMeta {
  ai: boolean;
  /** Written by the premium model (luxury, Jain and vegan trips). */
  premium?: boolean;
  aiAvailable: boolean;
  /** Days still being written, by day number, with the outline's one-line plan for each. */
  pending?: Record<number, string>;
  notice?: string;
  plansLeft?: number;
  editsLeft?: number;
}

function planned(itinerary: Itinerary, flight: FlightQuote, stay: StayQuote, days: number): CategoryBudget {
  const spent = { flights: flight.price, stay: stay.perPersonNight * Math.max(days - 1, 1), food: 0, activities: 0, transport: 0 };
  for (const day of itinerary.days) for (const item of day.items) spent[item.category] += item.costPerPerson;
  return spent;
}

export function ItineraryView({
  input,
  destination: d,
  itinerary,
  flight,
  stay,
  meta,
  onChange,
  busy,
  shareUrl,
  siteUrl,
}: {
  input: TripInput;
  destination: Destination;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  meta: PlanMeta;
  onChange: (change: string) => void;
  busy: boolean;
  /** Link to this saved plan, when saving is switched on and it has saved. */
  shareUrl?: string | null;
  siteUrl?: string;
}) {
  const [change, setChange] = useState("");
  const spent = planned(itinerary, flight, stay, input.days);
  const total = CATEGORIES.reduce((s, c) => s + spent[c], 0);
  const budgetTotal = CATEGORIES.reduce((s, c) => s + input.budget[c], 0);
  const writing = Object.keys(meta.pending ?? {}).length > 0;
  const canEdit = meta.aiAvailable && (meta.editsLeft ?? 1) > 0 && !writing;
  const city = ORIGIN_AIRPORTS.find((a) => a.code === input.origin)?.city ?? input.origin;
  const mode = travelMode(flight);
  const ground = mode === "train" || mode === "bus";
  const travelCta = { flight: "Check flights", train: "Check trains on IRCTC", bus: "Find buses on redBus", none: "" }[mode];
  const dateOf = (offset: number) => {
    const day = new Date(`${input.startDate}T00:00:00`);
    day.setDate(day.getDate() + offset);
    return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };

  const send = (text: string) => {
    if (!text.trim() || busy || !canEdit) return;
    onChange(text.trim());
    setChange("");
  };

  const from = findOrigin(input.origin);
  const pendingCount = Object.keys(meta.pending ?? {}).length;
  const caution = cautionFor(d, input.startDate);
  const fareNote = fareDateNote(flight, input.startDate);
  const travelNotes = [
    flight.label,
    fareNote,
    flight.airline ? `${flight.airline}, ${flight.transfers ? `${flight.transfers} stop${flight.transfers > 1 ? "s" : ""}` : "direct"}` : null,
    mode === "flight" && d.arrivalNote ? d.arrivalNote : null,
    ground && d.ground && d.ground.to !== d.name ? `The ${mode} goes to ${d.ground.to}. Get a cab or local transport on to ${d.name}.` : null,
  ].filter((n): n is string => Boolean(n));
  const tipSections = (
    [
      ["food", itinerary.foodTips],
      ["save", itinerary.moneySavingTips],
      ["before you go", itinerary.beforeYouGo],
    ] as const
  ).filter(([, tips]) => tips.length > 0);

  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-col gap-3.5">
        <LocalName d={d} className="text-lg text-faint" />
        <h1 className="text-[clamp(32px,7vw,48px)] font-semibold leading-[1.05] tracking-[-0.035em]">{itinerary.title}</h1>
        <p className="text-[clamp(16px,3.2vw,18px)] leading-relaxed tracking-[-0.01em] text-soft">{itinerary.summary}</p>
        <StatusPill live={writing}>
          {writing
            ? `Writing ${pendingCount} more day${pendingCount > 1 ? "s" : ""}…`
            : meta.ai
              ? meta.premium
                ? "Planned by premium AI"
                : "Planned by AI"
              : "Starter plan"}
        </StatusPill>
        <dl className="mt-1 flex flex-wrap gap-x-7 gap-y-2">
          {[
            ["from", city],
            ["leaving", dateOf(0)],
            ["trip", `${input.days} days`],
            ["travellers", input.travellers === 1 ? "Just you" : `${input.travellers} people`],
            ["style", TIER_INFO[input.tier].label],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-mono text-[11px] text-faint">{k}</dt>
              <dd className="text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex flex-col gap-12">
        {from && (
          <Sec label="route">
            <div className="max-w-[300px]">
              <IndiaMap
                origin={from}
                places={[{ id: d.id, name: d.name, lat: d.lat, lon: d.lon, fits: true }]}
                activeId={d.id}
                label={`Route from ${city} to ${d.name}`}
              />
            </div>
          </Sec>
        )}

        <Sec label="share">
          <ShareBar
            text={[
              `${itinerary.title}, leaving ${city} on ${dateOf(0)}.`,
              `About ${inr(total)} each, all in${input.travellers > 1 ? ` (${inr(total * input.travellers)} for ${input.travellers} of us)` : ""}.`,
              flight.label ? `Getting there: ${flight.label}.` : "",
              shareUrl ? `The plan: ${shareUrl}` : siteUrl ? `Planned on ghoomo: ${siteUrl}` : "",
            ]
              .filter(Boolean)
              .join("\n")}
            shareUrl={shareUrl ?? null}
          />
        </Sec>

        {(caution || meta.notice) && (
          <Sec label="heads up">
            <div className="flex flex-col gap-2 pt-2 text-[15px]">
              {caution && <p>{caution}</p>}
              {meta.notice && <p className="text-soft">{meta.notice}</p>}
            </div>
          </Sec>
        )}

        <Sec label="getting there">
          <div className={rowsClass}>
            <a
              href={mode === "none" ? undefined : flight.bookingUrl}
              onClick={() => mode !== "none" && track("book_travel")}
              target="_blank"
              rel="noopener noreferrer"
              className={`${rowClass} group ${mode === "none" ? "" : "hover:bg-row"}`}
            >
              <span className="inline-flex min-w-0 flex-wrap items-center gap-2 font-medium">
                {ground ? city : input.origin}
                <ModeIcon mode={mode} className="text-faint" />
                {ground ? (d.ground?.to ?? d.name) : mode === "none" ? d.name : d.airport}
                {travelCta && (
                  <span className="text-ink opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                    →
                  </span>
                )}
              </span>
              <span className={`${rowNote} text-ink`}>{inr(flight.price)}</span>
              <span className="col-span-2 text-sm text-soft">
                Per person, return{mode !== "none" && <> · <PriceSource kind="travel" live={flight.source === "live"} /></>}
                {travelNotes.map((n) => (
                  <span key={n} className="block">
                    {n}
                  </span>
                ))}
                {travelCta && <span className="mt-1 block font-mono text-xs text-faint">{travelCta.toLowerCase()} →</span>}
              </span>
            </a>
          </div>
        </Sec>

        <Sec label="stay">
          <div className={rowsClass}>
            <a href={stay.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => track("book_stay")} className={`${rowClass} group hover:bg-row`}>
              <span className="font-medium">
                {itinerary.stayRecommendation.area}
                <span className="ml-1.5 text-ink opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                  →
                </span>
              </span>
              <span className={`${rowNote} text-ink`}>{inr(stay.perPersonNight)}</span>
              <span className="col-span-2 text-sm text-soft">
                Per person, per night · <PriceSource kind="stay" live={stay.source === "live"} />
                <span className="block">{stay.name ?? itinerary.stayRecommendation.why}</span>
                <span className="mt-1 block font-mono text-xs text-faint">see places to stay →</span>
              </span>
            </a>
          </div>
        </Sec>

        {itinerary.days.map((day) => {
          const label = (
            <>
              day {String(day.day).padStart(2, "0")}
              <span className="block text-faint/80">{dateOf(day.day - 1).toLowerCase()}</span>
            </>
          );
          const pendingPlan = meta.pending?.[day.day];
          if (pendingPlan !== undefined) {
            return (
              <Sec key={day.day} label={label}>
                <div className="pt-2" aria-busy="true">
                  <h3 className="font-medium">{day.title}</h3>
                  <p className="text-sm text-soft">{pendingPlan}</p>
                  <div className="mt-4 space-y-2.5" aria-hidden="true">
                    {[85, 70, 78].map((w) => (
                      <div key={w} className="h-3 animate-pulse rounded-full bg-row" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 font-mono text-xs text-faint">
                    <Spinner /> writing this day
                  </p>
                </div>
              </Sec>
            );
          }
          const dayCost = day.items.reduce((sum, x) => sum + x.costPerPerson, 0);
          // Starter plans name the day after its main activity, so don't print it twice.
          const showTitle = !day.items.some((x) => x.title === day.title);
          return (
            <Sec key={day.day} label={label}>
              <div className="flex items-baseline justify-between gap-4 pt-2">
                {showTitle ? <h3 className="font-medium">{day.title}</h3> : <span />}
                <span className="font-mono text-xs tabular-nums text-faint">{inr(dayCost)}</span>
              </div>
              <ul className={`${rowsClass} mt-1`}>
                {day.items.map((item, i) => (
                  <li key={i} className={rowClass}>
                    <span className="inline-flex min-w-0 items-baseline gap-2.5">
                      <span className="translate-y-[-1px]">
                        <Dot category={item.category} />
                      </span>
                      <span className="font-medium">{item.title}</span>
                    </span>
                    <span className={rowNote}>{item.costPerPerson ? inr(item.costPerPerson) : "free"}</span>
                    <span className="col-span-2 pl-[18px] text-sm text-soft">
                      <span className="font-mono text-xs text-faint">{item.time.toLowerCase()}</span>
                      {item.details && <span className="block">{item.details}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Sec>
          );
        })}

        <Sec label="budget">
          <div className="pt-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{inr(total)}</span>
              <span className="text-soft">of {inr(budgetTotal)} per person</span>
            </p>
            <div className="mt-3">
              <Meter used={total} limit={budgetTotal} />
            </div>
            <p className="mt-2 font-mono text-xs text-faint">
              {total > budgetTotal ? `${inr(total - budgetTotal)} over budget` : `${inr(budgetTotal - total)} left to play with`}
              {input.travellers > 1 && ` · ${inr(total * input.travellers)} for the group`}
            </p>
            <div className="mt-6 space-y-4">
              {CATEGORIES.map((c) => (
                <div key={c} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-soft">
                      <Dot category={c} /> {CATEGORY_LABELS[c]}
                    </span>
                    <span className="font-mono text-xs tabular-nums">
                      {inr(spent[c])} <span className="text-faint">/ {inr(input.budget[c])}</span>
                    </span>
                  </div>
                  <Meter used={spent[c]} limit={input.budget[c]} />
                </div>
              ))}
            </div>
          </div>
        </Sec>

        {meta.aiAvailable && (
          <Sec label="change">
            <div className="pt-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium">Change the plan</h3>
                {meta.editsLeft !== undefined && <span className="font-mono text-xs text-faint">{meta.editsLeft} edits left today</span>}
              </div>
              {writing ? (
                <p className="mt-1 text-sm text-soft">You can ask for changes once every day is written.</p>
              ) : !canEdit ? (
                <p className="mt-1 text-sm text-soft">You&apos;ve used today&apos;s free edits. More tomorrow.</p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_CHANGES.map((q) => (
                      <button key={q} onClick={() => send(q)} disabled={busy} className={`${secondaryButton} disabled:opacity-40`}>
                        {q}
                      </button>
                    ))}
                  </div>
                  <form
                    className="mt-3 space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(change);
                    }}
                  >
                    <label htmlFor="change" className="sr-only">
                      What should change?
                    </label>
                    <textarea
                      id="change"
                      value={change}
                      onChange={(e) => setChange(e.target.value.slice(0, MAX_CHANGE_CHARS))}
                      rows={3}
                      placeholder="Swap day 3 for a beach day, add a rooftop dinner on the last night"
                      className={inputClass}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs tabular-nums text-faint">
                        {change.length}/{MAX_CHANGE_CHARS}
                      </span>
                      <button type="submit" disabled={busy || !change.trim()} className={primaryButton}>
                        {busy ? (
                          <>
                            <Spinner /> Updating
                          </>
                        ) : (
                          "Update plan"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </Sec>
        )}

        {tipSections.map(([title, tips]) => (
          <Sec key={title} label={title}>
            <ul className="space-y-1.5 pt-2 text-[15px]">
              {tips.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="text-faint">–</span>
                  {t}
                </li>
              ))}
            </ul>
          </Sec>
        ))}

        <PlanFeedback key={itinerary.title + itinerary.days.length} />
      </div>
    </div>
  );
}

/** Send the plan to the group. The link only appears once the plan is saved. */
function ShareBar({ text, shareUrl }: { text: string; shareUrl: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <WhatsAppLink text={text} onShare={() => track("share_whatsapp")} />
      {shareUrl && <CopyButton text={shareUrl} label="Copy link" onCopy={() => track("copy_link")} />}
      <span className="ml-1 text-sm text-faint">Send it to the group.</span>
    </div>
  );
}

const REASONS: { id: FeedbackReason; label: string }[] = [
  { id: "prices", label: "Prices look wrong" },
  { id: "places", label: "Wrong kind of places" },
  { id: "pace", label: "Too packed or too slow" },
  { id: "food", label: "Food doesn't suit us" },
  { id: "other", label: "Something else" },
];

/** A quick rating so we learn which plans work. Counted anonymously. */
function PlanFeedback() {
  const [state, setState] = useState<"ask" | "why" | "done">("ask");
  return (
    <Sec label="feedback">
      <div className="pt-1" aria-live="polite">
        {state === "ask" && (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 font-medium">Was this plan useful?</h2>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                track("plan_useful");
                setState("done");
              }}
            >
              Yes
            </button>
            <button type="button" className={secondaryButton} onClick={() => setState("why")}>
              Not really
            </button>
          </div>
        )}
        {state === "why" && (
          <div>
            <h2 className="font-medium">What was off?</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={secondaryButton}
                  onClick={() => {
                    track("plan_not_useful", r.id);
                    setState("done");
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {state === "done" && <p className="pt-1.5 text-soft">Thanks. That helps make the next plan better.</p>}
      </div>
    </Sec>
  );
}
