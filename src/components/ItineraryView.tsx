"use client";

import { useState } from "react";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { cautionFor, CATEGORIES, CATEGORY_LABELS, inr, TIER_INFO } from "@/lib/budget";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, Destination, FlightQuote, StayQuote, TripInput } from "@/lib/types";
import { fareDateNote, travelMode } from "@/lib/travel";
import { track } from "@/lib/track";
import type { FeedbackReason } from "@/lib/events";
import { CopyButton, WhatsAppLink } from "./Share";
import { Dot, inputClass, LocalName, Meter, ModeIcon, PriceSource, primaryButton, Spinner } from "./ui";

const QUICK_CHANGES = ["Make it cheaper", "More nightlife", "More veg food spots", "Slower pace", "Add one splurge"];
const MAX_CHANGE_CHARS = 300;

export interface PlanMeta {
  ai: boolean;
  aiAvailable: boolean;
  notice?: string;
  plansLeft?: number;
  editsLeft?: number;
}

function planned(itinerary: Itinerary, flight: FlightQuote, stay: StayQuote, days: number): CategoryBudget {
  const spent = { flights: flight.price, stay: stay.perPersonNight * Math.max(days - 1, 1), food: 0, activities: 0, transport: 0 };
  for (const day of itinerary.days) for (const item of day.items) spent[item.category] += item.costPerPerson;
  return spent;
}

const panel = "rounded-xl border-[1.5px] border-line bg-white";

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
  const canEdit = meta.aiAvailable && (meta.editsLeft ?? 1) > 0;
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

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-board px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="flex flex-wrap items-center gap-3">
          <LocalName d={d} className="text-2xl text-signal" />
          <span className="rounded-md border border-board-line px-2 py-0.5 text-xs font-semibold text-board-soft">
            {meta.ai ? "Planned by AI" : "Starter plan"}
          </span>
        </div>
        <h1 className="font-wide mt-2 text-3xl font-bold leading-tight sm:text-5xl">{itinerary.title}</h1>
        <p className="mt-3 max-w-2xl text-[#d6dde7]">{itinerary.summary}</p>
        <dl className="mt-6 flex flex-wrap gap-x-9 gap-y-3 text-sm">
          {[
            ["From", city],
            ["Leaving", dateOf(0)],
            ["Trip", `${input.days} days`],
            ["Travellers", input.travellers === 1 ? "Just you" : `${input.travellers} people`],
            ["Style", TIER_INFO[input.tier].label],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-board-soft">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

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

      {cautionFor(d, input.startDate) && (
        <div className="rounded-xl border-l-4 border-short-ink bg-white px-5 py-4 text-[15px]">
          <span className="font-semibold">Heads up for your dates:</span> {cautionFor(d, input.startDate)}
        </div>
      )}

      {meta.notice && <div className="rounded-xl border-[1.5px] border-signal bg-signal/15 px-5 py-4 text-sm text-ink">{meta.notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={mode === "none" ? undefined : flight.bookingUrl}
              onClick={() => mode !== "none" && track("book_travel")}
              target="_blank"
              rel="noopener noreferrer"
              className={`${panel} group block p-5 transition ${mode === "none" ? "" : "hover:border-ink"}`}
            >
              <div className="flex items-center justify-between gap-2 text-sm text-soft">
                <span className="inline-flex items-center gap-2 font-semibold text-ink">
                  {ground ? city : input.origin} <ModeIcon mode={mode} className="text-soft" /> {ground ? (d.ground?.to ?? d.name) : mode === "none" ? d.name : d.airport}
                </span>
                {mode !== "none" && <PriceSource kind="travel" live={flight.source === "live"} />}
              </div>
              <p className="mt-3">
                <span className="text-2xl font-extrabold tabular-nums">{inr(flight.price)}</span>
                <span className="text-sm text-soft"> per person, return</span>
              </p>
              {flight.label && <p className="text-sm text-soft">{flight.label}</p>}
              {fareDateNote(flight, input.startDate) && <p className="text-sm text-soft">{fareDateNote(flight, input.startDate)}</p>}
              {flight.airline && (
                <p className="text-sm text-soft">
                  {flight.airline}, {flight.transfers ? `${flight.transfers} stop${flight.transfers > 1 ? "s" : ""}` : "direct"}
                </p>
              )}
              {travelCta && (
                <p className="mt-4 text-sm font-semibold underline decoration-signal decoration-2 underline-offset-4 group-hover:decoration-ink">{travelCta}</p>
              )}
            </a>
            <a
              href={stay.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("book_stay")}
              className={`${panel} group block p-5 transition hover:border-ink`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">Stay in {itinerary.stayRecommendation.area}</span>
                <PriceSource kind="stay" live={stay.source === "live"} />
              </div>
              <p className="mt-3">
                <span className="text-2xl font-extrabold tabular-nums">{inr(stay.perPersonNight)}</span>
                <span className="text-sm text-soft"> per person, per night</span>
              </p>
              <p className="text-sm text-soft">{stay.name ?? itinerary.stayRecommendation.why}</p>
              <p className="mt-4 text-sm font-semibold underline decoration-signal decoration-2 underline-offset-4 group-hover:decoration-ink">
                See places to stay
              </p>
            </a>
          </div>
          {mode === "flight" && d.arrivalNote && <p className="px-1 text-[15px] text-soft">Getting there: {d.arrivalNote}</p>}
          {ground && d.ground && d.ground.to !== d.name && (
            <p className="px-1 text-[15px] text-soft">
              Getting there: the {mode} goes to {d.ground.to}. Get a cab or local transport on to {d.name}.
            </p>
          )}

          <ol className={`${panel} divide-y-[1.5px] divide-line`}>
            {itinerary.days.map((day) => {
              const dayCost = day.items.reduce((s, x) => s + x.costPerPerson, 0);
              // Starter plans name the day after its main activity, so don't print it twice.
              const showTitle = !day.items.some((x) => x.title === day.title);
              return (
                <li key={day.day} className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-6">
                  <div>
                    <div className="font-wide text-lg font-extrabold">Day {day.day}</div>
                    <div className="text-sm text-soft">{dateOf(day.day - 1)}</div>
                    <div className="mt-1 text-sm tabular-nums text-soft">{inr(dayCost)}</div>
                  </div>
                  <div>
                    {showTitle && <h3 className="mb-3 text-lg font-bold">{day.title}</h3>}
                    <ul className="space-y-3.5">
                      {day.items.map((item, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-1.5">
                            <Dot category={item.category} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-3">
                              <span className="font-semibold">{item.title}</span>
                              <span className="shrink-0 text-sm tabular-nums text-soft">{item.costPerPerson ? inr(item.costPerPerson) : "free"}</span>
                            </div>
                            <p className="text-sm text-soft">{item.time}</p>
                            {item.details && <p className="mt-0.5 text-[15px]">{item.details}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>

          {(
            [
              ["Food tips", itinerary.foodTips],
              ["Ways to save", itinerary.moneySavingTips],
              ["Before you go", itinerary.beforeYouGo],
            ] as const
          ).map(([title, tips]) =>
            tips.length ? (
              <section key={title} className={`${panel} p-5 sm:p-6`}>
                <h2 className="font-bold">{title}</h2>
                <ul className="mt-2 space-y-1.5 text-[15px]">
                  {tips.map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}

          <PlanFeedback key={itinerary.title + itinerary.days.length} />
        </div>

        <aside className="order-first space-y-4 lg:sticky lg:top-6 lg:order-none lg:self-start">
          <div className={`${panel} p-5 sm:p-6`}>
            <h2 className="text-sm font-semibold text-soft">Budget tracker, per person</h2>
            <p className="mt-2">
              <span className="text-3xl font-extrabold tabular-nums">{inr(total)}</span>
              <span className="text-soft"> of {inr(budgetTotal)}</span>
            </p>
            <div className="mt-3">
              <Meter used={total} limit={budgetTotal} />
            </div>
            <p className={`mt-2 text-sm font-semibold ${total > budgetTotal ? "text-short-ink" : "text-go-ink"}`}>
              {total > budgetTotal ? `${inr(total - budgetTotal)} over budget` : `${inr(budgetTotal - total)} left to play with`}
            </p>
            {input.travellers > 1 && <p className="text-sm text-soft">{inr(total * input.travellers)} for the group</p>}
            <div className="mt-5 space-y-3.5">
              {CATEGORIES.map((c) => (
                <div key={c} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-soft">
                      <Dot category={c} /> {CATEGORY_LABELS[c]}
                    </span>
                    <span className={`tabular-nums ${spent[c] > input.budget[c] ? "font-semibold text-short-ink" : ""}`}>
                      {inr(spent[c])} <span className="text-soft">of {inr(input.budget[c])}</span>
                    </span>
                  </div>
                  <Meter used={spent[c]} limit={input.budget[c]} />
                </div>
              ))}
            </div>
          </div>

          {meta.aiAvailable && (
            <div className={`${panel} p-5 sm:p-6`}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold">Change the plan</h2>
                {meta.editsLeft !== undefined && <span className="text-xs text-soft">{meta.editsLeft} edits left today</span>}
              </div>
              {!canEdit ? (
                <p className="mt-2 text-sm text-soft">You&apos;ve used today&apos;s free edits. More tomorrow.</p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_CHANGES.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        disabled={busy}
                        className="rounded-lg border-[1.5px] border-line px-2.5 py-1 text-sm font-semibold text-soft transition hover:border-ink hover:text-ink disabled:opacity-50"
                      >
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
                      <span className="text-xs tabular-nums text-soft">
                        {change.length}/{MAX_CHANGE_CHARS}
                      </span>
                      <button type="submit" disabled={busy || !change.trim()} className={`${primaryButton} px-4 py-2 text-sm`}>
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
          )}
        </aside>
      </div>
    </div>
  );
}

/** Send the plan to the group. The link only appears once the plan is saved. */
function ShareBar({ text, shareUrl }: { text: string; shareUrl: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-soft">Send it to the group</span>
      <WhatsAppLink text={text} onShare={() => track("share_whatsapp")} />
      {shareUrl && <CopyButton text={shareUrl} label="Copy link" onCopy={() => track("copy_link")} />}
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
  const chip = "rounded-lg border-[1.5px] border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-ink";
  return (
    <section className={`${panel} p-5 sm:p-6`} aria-live="polite">
      {state === "ask" && (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-2 font-bold">Was this plan useful?</h2>
          <button
            type="button"
            className={chip}
            onClick={() => {
              track("plan_useful");
              setState("done");
            }}
          >
            Yes
          </button>
          <button type="button" className={chip} onClick={() => setState("why")}>
            Not really
          </button>
        </div>
      )}
      {state === "why" && (
        <div>
          <h2 className="font-bold">What was off?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={chip}
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
      {state === "done" && <p className="text-soft">Thanks. That helps make the next plan better.</p>}
    </section>
  );
}
