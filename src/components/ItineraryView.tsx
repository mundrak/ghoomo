"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, inr } from "@/lib/budget";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, Destination, FlightQuote, StayQuote, TripInput } from "@/lib/types";
import { Badge, inputClass, Meter } from "./ui";

const QUICK_CHANGES = [
  "Make it cheaper",
  "Add more nightlife",
  "More vegetarian food spots",
  "Slower pace, fewer early mornings",
  "Add one splurge experience",
];

export function planned(itinerary: Itinerary, flight: FlightQuote, stay: StayQuote, days: number): CategoryBudget {
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
  ai,
  onChange,
  busy,
}: {
  input: TripInput;
  destination: Destination;
  itinerary: Itinerary;
  flight: FlightQuote;
  stay: StayQuote;
  ai: boolean;
  onChange: (change: string) => void;
  busy: boolean;
}) {
  const [change, setChange] = useState("");
  const spent = planned(itinerary, flight, stay, input.days);
  const total = CATEGORIES.reduce((s, c) => s + spent[c], 0);
  const budgetTotal = CATEGORIES.reduce((s, c) => s + input.budget[c], 0);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    onChange(text.trim());
    setChange("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-semibold text-stone-900">{itinerary.title}</h2>
          <p className="mt-1 text-stone-600">{itinerary.summary}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-stone-200 bg-white p-4 hover:border-teal-700">
            <div className="flex items-center justify-between text-sm text-stone-500">
              Flights {input.origin} ⇄ {d.airport} <Badge live={flight.source === "live"} />
            </div>
            <div className="mt-1 text-lg font-semibold text-stone-900">{inr(flight.price)} <span className="text-sm font-normal text-stone-500">per person, return</span></div>
            {flight.airline && <div className="text-sm text-stone-600">{flight.airline} · {flight.transfers ? `${flight.transfers} stop(s)` : "Direct"}</div>}
            <div className="mt-2 text-sm font-medium text-teal-700">See flights →</div>
          </a>
          <a href={stay.bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-stone-200 bg-white p-4 hover:border-teal-700">
            <div className="flex items-center justify-between text-sm text-stone-500">
              Stay · {itinerary.stayRecommendation.area} <Badge live={stay.source === "live"} />
            </div>
            <div className="mt-1 text-lg font-semibold text-stone-900">{inr(stay.perPersonNight)} <span className="text-sm font-normal text-stone-500">per person / night</span></div>
            <div className="text-sm text-stone-600">{stay.name ?? itinerary.stayRecommendation.why}</div>
            <div className="mt-2 text-sm font-medium text-teal-700">See places to stay →</div>
          </a>
        </div>
        {d.arrivalNote && <p className="text-sm text-stone-600">✈︎ {d.arrivalNote}</p>}

        <ol className="space-y-4">
          {itinerary.days.map((day) => (
            <li key={day.day} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="font-semibold text-stone-900">
                Day {day.day} · {day.title}
              </h3>
              <ul className="mt-3 divide-y divide-stone-100">
                {day.items.map((item, i) => (
                  <li key={i} className="flex gap-4 py-2.5">
                    <span className="w-24 shrink-0 text-sm text-stone-500">{item.time}</span>
                    <div className="flex-1">
                      <div className="font-medium text-stone-800">{item.title}</div>
                      {item.details && <p className="text-sm text-stone-600">{item.details}</p>}
                    </div>
                    <span className="shrink-0 text-sm text-stone-700">{item.costPerPerson ? inr(item.costPerPerson) : "Free"}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        {[
          ["Food tips", itinerary.foodTips],
          ["Ways to save", itinerary.moneySavingTips],
          ["Before you go", itinerary.beforeYouGo],
        ].map(([title, tips]) =>
          (tips as string[]).length ? (
            <section key={title as string} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="font-semibold text-stone-900">{title as string}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                {(tips as string[]).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="font-semibold text-stone-900">Budget tracker</h3>
          <p className="text-sm text-stone-500">Per person · ×{input.travellers} for the group</p>
          <div className="mt-3 text-2xl font-semibold text-stone-900">
            {inr(total)} <span className="text-base font-normal text-stone-500">/ {inr(budgetTotal)}</span>
          </div>
          <Meter used={total} limit={budgetTotal} />
          <p className={`mt-1 text-sm ${total > budgetTotal ? "text-rose-600" : "text-emerald-700"}`}>
            {total > budgetTotal ? `${inr(total - budgetTotal)} over budget` : `${inr(budgetTotal - total)} left to play with`}
          </p>
          <div className="mt-4 space-y-3">
            {CATEGORIES.map((c) => (
              <div key={c}>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">{CATEGORY_LABELS[c]}</span>
                  <span className={spent[c] > input.budget[c] ? "text-rose-600" : "text-stone-800"}>
                    {inr(spent[c])} / {inr(input.budget[c])}
                  </span>
                </div>
                <Meter used={spent[c]} limit={input.budget[c]} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="font-semibold text-stone-900">Change the plan</h3>
          {ai ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_CHANGES.map((q) => (
                  <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:border-teal-700 disabled:opacity-50">
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
                  onChange={(e) => setChange(e.target.value)}
                  rows={3}
                  placeholder="e.g. Swap day 3 for a beach day, and find a rooftop dinner for our last night"
                  className={inputClass}
                />
                <button type="submit" disabled={busy || !change.trim()} className="w-full rounded-xl bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
                  {busy ? "Updating…" : "Update itinerary"}
                </button>
              </form>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-600">Editing by chat turns on once an Anthropic API key is added (see README).</p>
          )}
        </div>
      </aside>
    </div>
  );
}
