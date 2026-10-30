"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, inr, TIER_INFO } from "@/lib/budget";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, Destination, FlightQuote, StayQuote, TripInput } from "@/lib/types";
import { Badge, CATEGORY_STYLE, inputClass, Meter, Spinner } from "./ui";

const QUICK_CHANGES = ["💸 Make it cheaper", "🎉 More nightlife", "🥗 More veg food spots", "😴 Slower pace", "✨ Add one splurge"];
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

  const send = (text: string) => {
    if (!text.trim() || busy || !canEdit) return;
    onChange(text.trim());
    setChange("");
  };

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{d.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold sm:text-3xl">{itinerary.title}</h2>
            <p className="mt-2 max-w-2xl text-teal-50">{itinerary.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {[
                `📅 ${new Date(`${input.startDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${input.days} days`,
                `👥 ${input.travellers} ${input.travellers === 1 ? "person" : "people"}`,
                `${TIER_INFO[input.tier].label} style`,
                meta.ai ? "🤖 Planned by AI" : "📋 Starter plan",
              ].map((t) => (
                <span key={t} className="rounded-full bg-white/15 px-3 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {meta.notice && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{meta.notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-teal-600 hover:shadow-sm">
              <div className="flex items-center justify-between text-sm text-stone-500">
                ✈️ {input.origin} ⇄ {d.airport} <Badge live={flight.source === "live"} />
              </div>
              <div className="mt-2 text-xl font-bold text-stone-900">
                {inr(flight.price)} <span className="text-sm font-normal text-stone-500">per person, return</span>
              </div>
              {flight.airline && (
                <div className="text-sm text-stone-600">
                  {flight.airline} · {flight.transfers ? `${flight.transfers} stop(s)` : "Direct"}
                </div>
              )}
              <div className="mt-3 text-sm font-semibold text-teal-700 group-hover:underline">Check flights →</div>
            </a>
            <a href={stay.bookingUrl} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-teal-600 hover:shadow-sm">
              <div className="flex items-center justify-between text-sm text-stone-500">
                🛏️ Stay in {itinerary.stayRecommendation.area} <Badge live={stay.source === "live"} />
              </div>
              <div className="mt-2 text-xl font-bold text-stone-900">
                {inr(stay.perPersonNight)} <span className="text-sm font-normal text-stone-500">per person / night</span>
              </div>
              <div className="text-sm text-stone-600">{stay.name ?? itinerary.stayRecommendation.why}</div>
              <div className="mt-3 text-sm font-semibold text-teal-700 group-hover:underline">See places to stay →</div>
            </a>
          </div>
          {d.arrivalNote && <p className="rounded-xl bg-white px-4 py-3 text-sm text-stone-600">🧭 {d.arrivalNote}</p>}

          <ol className="space-y-4">
            {itinerary.days.map((day) => {
              const dayCost = day.items.reduce((s, x) => s + x.costPerPerson, 0);
              return (
                <li key={day.day} className="rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-bold text-stone-900">
                      <span className="mr-2 rounded-lg bg-teal-50 px-2 py-0.5 text-sm text-teal-700">Day {day.day}</span>
                      {day.title}
                    </h3>
                    <span className="shrink-0 text-sm text-stone-500">{inr(dayCost)}</span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {day.items.map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-lg">{CATEGORY_STYLE[item.category].icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-3">
                            <span className="font-medium text-stone-800">{item.title}</span>
                            <span className="shrink-0 text-sm text-stone-700">{item.costPerPerson ? inr(item.costPerPerson) : "Free"}</span>
                          </div>
                          <div className="text-xs text-stone-500">{item.time}</div>
                          {item.details && <p className="mt-0.5 text-sm text-stone-600">{item.details}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          {(
            [
              ["🍽️ Food tips", itinerary.foodTips],
              ["💸 Ways to save", itinerary.moneySavingTips],
              ["🧳 Before you go", itinerary.beforeYouGo],
            ] as const
          ).map(([title, tips]) =>
            tips.length ? (
              <section key={title} className="rounded-2xl border border-stone-200 bg-white p-5">
                <h3 className="font-bold text-stone-900">{title}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                  {tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>

        <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="font-bold text-stone-900">Budget tracker</h3>
            <p className="text-sm text-stone-500">Per person{input.travellers > 1 ? ` · ${inr(total * input.travellers)} for the group` : ""}</p>
            <div className="mt-3 text-3xl font-bold text-stone-900">
              {inr(total)} <span className="text-base font-normal text-stone-500">of {inr(budgetTotal)}</span>
            </div>
            <Meter used={total} limit={budgetTotal} />
            <p className={`mt-1.5 text-sm font-medium ${total > budgetTotal ? "text-rose-600" : "text-emerald-700"}`}>
              {total > budgetTotal ? `${inr(total - budgetTotal)} over budget` : `${inr(budgetTotal - total)} left to play with`}
            </p>
            <div className="mt-5 space-y-3">
              {CATEGORIES.map((c) => (
                <div key={c}>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {CATEGORY_STYLE[c].icon} {CATEGORY_LABELS[c]}
                    </span>
                    <span className={spent[c] > input.budget[c] ? "font-medium text-rose-600" : "text-stone-800"}>
                      {inr(spent[c])} / {inr(input.budget[c])}
                    </span>
                  </div>
                  <Meter used={spent[c]} limit={input.budget[c]} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold text-stone-900">Change the plan</h3>
              {meta.aiAvailable && meta.editsLeft !== undefined && <span className="text-xs text-stone-500">{meta.editsLeft} AI edits left today</span>}
            </div>
            {!meta.aiAvailable ? (
              <p className="mt-2 text-sm text-stone-600">Editing by chat is coming soon.</p>
            ) : !canEdit ? (
              <p className="mt-2 text-sm text-stone-600">You&apos;ve used today&apos;s free edits. Come back tomorrow for more.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_CHANGES.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q.slice(q.indexOf(" ") + 1))}
                      disabled={busy}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-teal-600 disabled:opacity-50"
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
                    placeholder="e.g. Swap day 3 for a beach day and add a rooftop dinner on our last night"
                    className={inputClass}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-400">
                      {change.length}/{MAX_CHANGE_CHARS}
                    </span>
                    <button
                      type="submit"
                      disabled={busy || !change.trim()}
                      className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
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
