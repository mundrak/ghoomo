"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, inr, TIER_INFO } from "@/lib/budget";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, Destination, FlightQuote, StayQuote, TripInput } from "@/lib/types";
import { Badge, Dot, inputClass, Kicker, Meter, primaryButton, Spinner } from "./ui";

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

const card = "rounded-[24px] border-[1.5px] border-line bg-white p-6";

export function ItineraryView({
  input,
  destination: d,
  itinerary,
  flight,
  stay,
  meta,
  onChange,
  busy,
}: {
  input: TripInput;
  destination: Destination;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  meta: PlanMeta;
  onChange: (change: string) => void;
  busy: boolean;
}) {
  const [change, setChange] = useState("");
  const spent = planned(itinerary, flight, stay, input.days);
  const total = CATEGORIES.reduce((s, c) => s + spent[c], 0);
  const budgetTotal = CATEGORIES.reduce((s, c) => s + input.budget[c], 0);
  const canEdit = meta.aiAvailable && (meta.editsLeft ?? 1) > 0;
  const startLabel = new Date(`${input.startDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const send = (text: string) => {
    if (!text.trim() || busy || !canEdit) return;
    onChange(text.trim());
    setChange("");
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-8 text-cream sm:px-10 sm:py-10">
        <p className="font-hand text-2xl text-mustard">{meta.ai ? "planned just for you" : "a starter plan"}</p>
        <h2 className="mt-1 font-display text-3xl leading-tight sm:text-5xl">{itinerary.title}</h2>
        <p className="mt-3 max-w-2xl text-cream/75">{itinerary.summary}</p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {[
            `${startLabel} · ${input.days} days`,
            `${input.travellers} ${input.travellers === 1 ? "person" : "people"}`,
            `${TIER_INFO[input.tier].label} style`,
          ].map((t) => (
            <span key={t} className="rounded-full border border-cream/20 px-3.5 py-1 text-cream/90">
              {t}
            </span>
          ))}
        </div>
      </header>

      {meta.notice && <div className="rounded-2xl bg-butter px-5 py-4 text-sm text-ink">{meta.notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: flight.bookingUrl,
                label: `Flights · ${input.origin} ⇄ ${d.airport}`,
                live: flight.source === "live",
                price: flight.price,
                unit: "per person, return",
                note: flight.airline ? `${flight.airline} · ${flight.transfers ? `${flight.transfers} stop(s)` : "direct"}` : undefined,
                cta: "Check flights",
              },
              {
                href: stay.bookingUrl,
                label: `Stay · ${itinerary.stayRecommendation.area}`,
                live: stay.source === "live",
                price: stay.perPersonNight,
                unit: "per person / night",
                note: stay.name ?? itinerary.stayRecommendation.why,
                cta: "See places to stay",
              },
            ].map((x) => (
              <a key={x.label} href={x.href} target="_blank" rel="noopener noreferrer" className={`${card} group block transition hover:border-ink`}>
                <div className="flex items-center justify-between gap-2 text-sm text-muted">
                  {x.label} <Badge live={x.live} />
                </div>
                <p className="mt-2">
                  <span className="font-display text-2xl tabular-nums text-ink">{inr(x.price)}</span>
                  <span className="text-sm text-muted"> {x.unit}</span>
                </p>
                {x.note && <p className="mt-0.5 text-sm text-ink-soft">{x.note}</p>}
                <p className="mt-4 text-sm font-semibold text-ink underline decoration-mustard decoration-2 underline-offset-4 group-hover:text-orange">
                  {x.cta} →
                </p>
              </a>
            ))}
          </div>
          {d.arrivalNote && <p className="px-1 text-sm text-ink-soft">Getting there: {d.arrivalNote}</p>}

          <ol className="space-y-4">
            {itinerary.days.map((day) => {
              const dayCost = day.items.reduce((s, x) => s + x.costPerPerson, 0);
              return (
                <li key={day.day} className={card}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <Kicker>Day {String(day.day).padStart(2, "0")}</Kicker>
                      <h3 className="mt-1 text-lg font-bold text-ink">{day.title}</h3>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{inr(dayCost)}</span>
                  </div>
                  <ul className="mt-4 space-y-3.5 border-l-[1.5px] border-line pl-5">
                    {day.items.map((item, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[25px] top-1.5 ring-4 ring-white">
                          <Dot category={item.category} />
                        </span>
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold text-ink">{item.title}</span>
                          <span className="shrink-0 text-sm tabular-nums text-ink-soft">{item.costPerPerson ? inr(item.costPerPerson) : "free"}</span>
                        </div>
                        <p className="text-xs text-muted">{item.time}</p>
                        {item.details && <p className="mt-0.5 text-sm text-ink-soft">{item.details}</p>}
                      </li>
                    ))}
                  </ul>
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
              <section key={title} className={card}>
                <h3 className="font-bold text-ink">{title}</h3>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  {tips.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-orange">→</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>

        <aside className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none lg:self-start">
          <div className={card}>
            <Kicker>Budget tracker · per person</Kicker>
            <p className="mt-3">
              <span className="font-display text-3xl tabular-nums text-ink">{inr(total)}</span>
              <span className="text-muted"> of {inr(budgetTotal)}</span>
            </p>
            <div className="mt-3">
              <Meter used={total} limit={budgetTotal} />
            </div>
            <p className={`mt-2 text-sm font-semibold ${total > budgetTotal ? "text-orange" : "text-ink-soft"}`}>
              {total > budgetTotal ? `${inr(total - budgetTotal)} over budget` : `${inr(budgetTotal - total)} left to play with`}
            </p>
            {input.travellers > 1 && <p className="text-xs text-muted">{inr(total * input.travellers)} for the whole group</p>}
            <div className="mt-5 space-y-3.5">
              {CATEGORIES.map((c) => (
                <div key={c} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-ink-soft">
                      <Dot category={c} /> {CATEGORY_LABELS[c]}
                    </span>
                    <span className={`tabular-nums ${spent[c] > input.budget[c] ? "font-semibold text-orange" : "text-ink"}`}>
                      {inr(spent[c])} <span className="text-muted">/ {inr(input.budget[c])}</span>
                    </span>
                  </div>
                  <Meter used={spent[c]} limit={input.budget[c]} />
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-bold text-ink">Change the plan</h3>
              {meta.aiAvailable && meta.editsLeft !== undefined && <span className="text-xs text-muted">{meta.editsLeft} edits left today</span>}
            </div>
            {!meta.aiAvailable ? (
              <p className="mt-2 text-sm text-ink-soft">Editing by chat is coming soon.</p>
            ) : !canEdit ? (
              <p className="mt-2 text-sm text-ink-soft">You&apos;ve used today&apos;s free edits. More tomorrow.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {QUICK_CHANGES.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={busy}
                      className="rounded-full border-[1.5px] border-line px-3 py-1 text-xs font-semibold text-ink-soft transition hover:border-ink disabled:opacity-40"
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
                  <textarea
                    value={change}
                    onChange={(e) => setChange(e.target.value.slice(0, MAX_CHANGE_CHARS))}
                    rows={3}
                    placeholder="Swap day 3 for a beach day, add a rooftop dinner on the last night…"
                    className={inputClass}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs tabular-nums text-muted">
                      {change.length}/{MAX_CHANGE_CHARS}
                    </span>
                    <button type="submit" disabled={busy || !change.trim()} className={`${primaryButton} px-5 py-2 text-sm`}>
                      {busy ? (
                        <>
                          <Spinner /> Updating…
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
        </aside>
      </div>
    </div>
  );
}
