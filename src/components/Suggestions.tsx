"use client";

import { CATEGORIES, CATEGORY_LABELS, inr, sumBudget } from "@/lib/budget";
import type { Suggestion, TripInput } from "@/lib/types";
import { Badge, CATEGORY_STYLE, Spinner, SplitBar } from "./ui";

export function Suggestions({
  input,
  suggestions,
  onPick,
  busyId,
}: {
  input: TripInput;
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
  busyId?: string;
}) {
  const budget = sumBudget(input.budget);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-stone-900">Where {inr(budget)} per person can take you</h2>
        <p className="text-stone-600">
          {input.travellers} {input.travellers === 1 ? "traveller" : "travellers"} · {input.days} days · best matches first
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((s, i) => {
          const d = s.destination;
          const fits = s.overBudgetBy === 0;
          return (
            <article key={d.id} className="flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between bg-gradient-to-br from-teal-600 to-teal-800 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{d.emoji}</span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">{d.name}</h3>
                    <p className="text-sm text-teal-100">{d.country}</p>
                  </div>
                </div>
                {i === 0 && <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950">Top pick</span>}
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-bold text-stone-900">{inr(s.cost.total)}</span>
                    <span className="text-sm text-stone-500"> /person</span>
                  </div>
                  <span className={`text-sm font-medium ${fits ? "text-emerald-700" : "text-rose-600"}`}>
                    {fits ? `${inr(budget - s.cost.total)} under budget` : `${inr(s.overBudgetBy)} over`}
                  </span>
                </div>

                <div className="space-y-2">
                  <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: s.cost[c] }))} />
                  <ul className="space-y-1 text-sm text-stone-600">
                    {CATEGORIES.map((c) => (
                      <li key={c} className="flex items-center justify-between gap-2">
                        <span>
                          {CATEGORY_STYLE[c].icon} {CATEGORY_LABELS[c]}
                        </span>
                        <span className="text-stone-800">{inr(s.cost[c])}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    Flights: <Badge live={s.flight.source === "live"} />
                  </div>
                </div>

                <ul className="space-y-1 text-sm text-stone-700">
                  {s.reasons.slice(0, 3).map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">🛂 {d.visa}</p>

                <button
                  onClick={() => onPick(s)}
                  disabled={Boolean(busyId)}
                  className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {busyId === d.id ? (
                    <>
                      <Spinner /> Planning your trip…
                    </>
                  ) : (
                    "Plan this trip →"
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
