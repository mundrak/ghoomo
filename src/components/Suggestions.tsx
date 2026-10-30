"use client";

import { CATEGORIES, CATEGORY_LABELS, inr, sumBudget } from "@/lib/budget";
import type { Suggestion, TripInput } from "@/lib/types";
import { Badge, Dot, Kicker, primaryButton, Spinner, SplitBar } from "./ui";

const SWATCHES = ["bg-peach", "bg-sage", "bg-butter", "bg-mustard/70"];

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
    <div className="space-y-8">
      <div>
        <Kicker>
          {input.travellers} {input.travellers === 1 ? "traveller" : "travellers"} · {input.days} days · best matches first
        </Kicker>
        <h2 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Where {inr(budget)} can take you</h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((s, i) => {
          const d = s.destination;
          const fits = s.overBudgetBy === 0;
          return (
            <article
              key={d.id}
              className="relative flex flex-col overflow-hidden rounded-[24px] border-[1.5px] border-line bg-white shadow-[0_4px_18px_rgba(51,41,31,0.05)]"
            >
              <div className={`${SWATCHES[i % SWATCHES.length]} px-6 pb-5 pt-6`}>
                <p className="text-sm font-semibold text-ink-soft">{d.country}</p>
                <h3 className="mt-1 font-display text-2xl leading-tight text-ink">{d.name}</h3>
              </div>
              {i === 0 && (
                <span className="absolute right-4 top-4 rotate-6 rounded-full bg-orange px-3 py-0.5 font-hand text-lg text-white">top pick</span>
              )}

              <div className="flex flex-1 flex-col gap-5 p-6">
                <div className="flex items-baseline justify-between gap-2">
                  <p>
                    <span className="font-display text-2xl tabular-nums text-ink">{inr(s.cost.total)}</span>
                    <span className="text-sm text-muted"> / person</span>
                  </p>
                  <span className={`text-sm font-semibold ${fits ? "text-ink-soft" : "text-orange"}`}>
                    {fits ? `${inr(budget - s.cost.total)} to spare` : `${inr(s.overBudgetBy)} over`}
                  </span>
                </div>

                <div className="space-y-3">
                  <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: s.cost[c] }))} />
                  <ul className="space-y-1.5 text-sm">
                    {CATEGORIES.map((c) => (
                      <li key={c} className="flex items-center justify-between gap-2 text-ink-soft">
                        <span className="inline-flex items-center gap-2">
                          <Dot category={c} />
                          {CATEGORY_LABELS[c]}
                          {c === "flights" && <Badge live={s.flight.source === "live"} />}
                        </span>
                        <span className="tabular-nums text-ink">{inr(s.cost[c])}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <ul className="space-y-1 border-t-[1.5px] border-line pt-4 text-sm text-ink-soft">
                  {s.reasons.slice(0, 3).map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="text-orange">→</span>
                      {r}
                    </li>
                  ))}
                  <li className="flex gap-2">
                    <span className="text-orange">→</span>
                    Visa: {d.visa}
                  </li>
                </ul>

                <button onClick={() => onPick(s)} disabled={Boolean(busyId)} className={`${primaryButton} mt-auto w-full`}>
                  {busyId === d.id ? (
                    <>
                      <Spinner /> Planning…
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
