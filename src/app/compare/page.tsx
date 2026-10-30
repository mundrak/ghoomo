"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { primaryButton, inputClass, Spinner } from "@/components/ui";
import { CATEGORIES, CATEGORY_LABELS, inr } from "@/lib/budget";
import { COMPARE_TRIPS } from "@/lib/compareTrips";
import type { Itinerary } from "@/lib/itinerary";
import type { CategoryBudget, FlightQuote, StayQuote, TripInput } from "@/lib/types";

// Private page: run the same five trips through each model and compare plans, cost and speed.
// Needs the STATS_KEY. Not linked from the site.

const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
];

interface Result {
  itinerary: Itinerary;
  costUsd: number;
  seconds: number;
  flight: FlightQuote;
  stay: StayQuote;
  input: TripInput;
}
type Cell = { state: "idle" } | { state: "running" } | { state: "done"; r: Result } | { state: "error"; message: string };

function planned(r: Result): CategoryBudget {
  const spent = { flights: r.flight.price, stay: r.stay.perPersonNight * Math.max(r.input.days - 1, 1), food: 0, activities: 0, transport: 0 };
  for (const d of r.itinerary.days) for (const x of d.items) spent[x.category] += x.costPerPerson;
  return spent;
}

export default function ComparePage() {
  const [key, setKey] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [open, setOpen] = useState<string | null>(null);
  const id = (t: number, m: string) => `${t}:${m}`;

  const run = async (t: number, m: string) => {
    setCells((c) => ({ ...c, [id(t, m)]: { state: "running" } }));
    try {
      const res = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, trip: t, model: m }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setCells((c) => ({ ...c, [id(t, m)]: { state: "done", r: data } }));
    } catch (e) {
      setCells((c) => ({ ...c, [id(t, m)]: { state: "error", message: e instanceof Error ? e.message : String(e) } }));
    }
  };
  // One trip at a time across all three models, so a run can't trigger rate limits.
  const runAll = async () => {
    for (let t = 0; t < COMPARE_TRIPS.length; t++) await Promise.all(MODELS.map((m) => run(t, m.id)));
  };

  const totals = MODELS.map((m) => {
    const done = COMPARE_TRIPS.map((_, t) => cells[id(t, m.id)]).filter((c): c is Extract<Cell, { state: "done" }> => c?.state === "done");
    return {
      ...m,
      count: done.length,
      cost: done.reduce((s, c) => s + c.r.costUsd, 0),
      seconds: done.length ? Math.round(done.reduce((s, c) => s + c.r.seconds, 0) / done.length) : 0,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <Logo />
      <h1 className="font-wide mt-8 text-3xl font-bold">Compare AI models</h1>
      <p className="mt-2 max-w-3xl text-soft">
        Runs the same five trips through Opus, Sonnet and Haiku. Read the plans side by side and pick the cheapest model whose plans you&apos;d
        happily send to a friend. A full run costs roughly $0.80 and counts toward the daily AI cap.
      </p>
      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void runAll();
        }}
      >
        <label className="text-sm font-semibold text-soft">
          Your STATS_KEY
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className={`${inputClass} mt-1 w-80`} />
        </label>
        <button type="submit" disabled={!key} className={primaryButton}>
          Run all 15 plans
        </button>
      </form>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {totals.map((t) => (
          <div key={t.id} className="rounded-xl border-[1.5px] border-line bg-white p-4">
            <div className="font-bold">{t.label}</div>
            <div className="mt-1 text-sm text-soft">
              {t.count} of {COMPARE_TRIPS.length} done · ${t.cost.toFixed(3)} total · {t.count ? `$${(t.cost / t.count).toFixed(3)} (${inr((t.cost / t.count) * 88)}) per plan` : "–"} · {t.seconds}s average
            </div>
          </div>
        ))}
      </div>

      {COMPARE_TRIPS.map((trip, t) => (
        <section key={trip.label} className="mt-10">
          <h2 className="text-lg font-bold">{trip.label}</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {MODELS.map((m) => {
              const c = cells[id(t, m.id)] ?? { state: "idle" };
              const k = id(t, m.id);
              return (
                <div key={m.id} className="rounded-xl border-[1.5px] border-line bg-white p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{m.label}</span>
                    <button type="button" disabled={!key || c.state === "running"} onClick={() => void run(t, m.id)} className="text-soft underline disabled:no-underline">
                      {c.state === "running" ? <Spinner /> : c.state === "done" ? "Run again" : "Run"}
                    </button>
                  </div>
                  {c.state === "error" && <p className="mt-2 font-semibold text-short-ink">{c.message}</p>}
                  {c.state === "done" && (
                    <Plan r={c.r} expanded={open === k} onToggle={() => setOpen(open === k ? null : k)} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Plan({ r, expanded, onToggle }: { r: Result; expanded: boolean; onToggle: () => void }) {
  const spent = planned(r);
  const over = CATEGORIES.filter((c) => spent[c] > r.input.budget[c]);
  const total = CATEGORIES.reduce((s, c) => s + spent[c], 0);
  const budget = CATEGORIES.reduce((s, c) => s + r.input.budget[c], 0);
  return (
    <div className="mt-2 space-y-2">
      <p className="text-soft">
        ${r.costUsd.toFixed(3)} · {r.seconds}s · {inr(total)} of {inr(budget)}{" "}
        {over.length ? <span className="font-semibold text-short-ink">over on {over.map((c) => CATEGORY_LABELS[c].toLowerCase()).join(", ")}</span> : <span className="font-semibold text-go-ink">within budget</span>}
      </p>
      <p className="font-semibold">{r.itinerary.title}</p>
      <p>{r.itinerary.summary}</p>
      <ol className="space-y-1">
        {r.itinerary.days.map((d) => (
          <li key={d.day}>
            <span className="font-semibold">Day {d.day}:</span> {d.title}
            {expanded && (
              <ul className="ml-4 mt-1 list-disc text-soft">
                {d.items.map((x, i) => (
                  <li key={i}>
                    {x.time}: {x.title} ({x.costPerPerson ? inr(x.costPerPerson) : "free"}){x.details ? ` — ${x.details}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {expanded && (
        <>
          {[["Food tips", r.itinerary.foodTips], ["Ways to save", r.itinerary.moneySavingTips], ["Before you go", r.itinerary.beforeYouGo]].map(([h, tips]) => (
            <div key={h as string}>
              <p className="font-semibold">{h as string}</p>
              <ul className="ml-4 list-disc text-soft">
                {(tips as string[]).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      <button type="button" onClick={onToggle} className="font-semibold underline decoration-signal decoration-2 underline-offset-4">
        {expanded ? "Show less" : "Show every item and tip"}
      </button>
    </div>
  );
}
