"use client";

import { CATEGORIES, CATEGORY_LABELS, inr, sumBudget } from "@/lib/budget";
import type { Suggestion, TripInput } from "@/lib/types";
import { Badge, Meter } from "./ui";

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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Where your {inr(budget)} per person can take you</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {suggestions.map((s) => {
          const d = s.destination;
          return (
            <article key={d.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">{d.name}</h3>
                  <p className="text-sm text-stone-500">{d.country}</p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${s.overBudgetBy ? "text-rose-600" : "text-stone-900"}`}>{inr(s.cost.total)}</div>
                  <div className="text-xs text-stone-500">per person, all in</div>
                </div>
              </div>
              <Meter used={s.cost.total} limit={budget} />
              {s.overBudgetBy > 0 && <p className="text-sm text-rose-600">{inr(s.overBudgetBy)} over your budget</p>}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <div key={c} className="flex justify-between gap-2 sm:block">
                    <dt className="text-stone-500">{CATEGORY_LABELS[c]}</dt>
                    <dd className="text-stone-800">
                      {inr(s.cost[c])} {c === "flights" && <Badge live={s.flight.source === "live"} />}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul className="space-y-1 text-sm text-stone-700">
                {s.reasons.map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
              <p className="text-xs text-stone-500">Visa: {d.visa}</p>

              <button
                onClick={() => onPick(s)}
                disabled={Boolean(busyId)}
                className="mt-auto rounded-xl bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {busyId === d.id ? "Planning…" : "Plan this trip"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
