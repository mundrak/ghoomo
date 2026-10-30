"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { inputClass, primaryButton, Spinner } from "@/components/ui";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { DESTINATIONS } from "@/data/destinations";

// Private page: writes AI plans in advance for the trip the form starts with, so most first-time
// visitors get a plan instantly and for free. Needs the STATS_KEY. Not linked from the site.

interface Result {
  made: number;
  skipped: number;
  failed: number;
  costUsd: number;
  errors: string[];
}
type Row = { state: "idle" } | { state: "running" } | { state: "done"; r: Result } | { state: "error"; message: string };

const monthOf = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 7);
};
const monthName = (m: string) => new Date(`${m}-15`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

// The form starts trips 30 days out. Cover the months that lands in from tomorrow until three weeks later.
const MONTHS = [...new Set([monthOf(31), monthOf(52)])];

export default function PregeneratePage() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState(false);
  const id = (origin: string, month: string) => `${origin}:${month}`;

  const run = async (origin: string, month: string) => {
    setRows((r) => ({ ...r, [id(origin, month)]: { state: "running" } }));
    try {
      const res = await fetch("/api/pregenerate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, origin, month }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setRows((r) => ({ ...r, [id(origin, month)]: { state: "done", r: data } }));
      return true;
    } catch (e) {
      setRows((r) => ({ ...r, [id(origin, month)]: { state: "error", message: e instanceof Error ? e.message : String(e) } }));
      return false;
    }
  };
  // One city at a time, so a run can't trigger the API's rate limits. Stops at the first error (like a wrong key).
  const runAll = async () => {
    setRunning(true);
    try {
      for (const month of MONTHS) for (const a of ORIGIN_AIRPORTS) if (!(await run(a.code, month))) return;
    } finally {
      setRunning(false);
    }
  };

  const done = Object.values(rows).filter((r): r is Extract<Row, { state: "done" }> => r.state === "done");
  const made = done.reduce((s, r) => s + r.r.made, 0);
  const cost = done.reduce((s, r) => s + r.r.costUsd, 0);
  const total = ORIGIN_AIRPORTS.length * DESTINATIONS.length * MONTHS.length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <Logo />
      <h1 className="font-wide mt-8 text-3xl font-bold">Pre-generate plans</h1>
      <p className="mt-2 max-w-2xl text-soft">
        Writes an AI plan for the trip the form starts with (5 students, 5 days, budget, hostel, no interests picked) from every city to
        every destination, for {MONTHS.map(monthName).join(" and ")}. That&apos;s up to {total} plans with the standard model, about $
        {(total * 0.003).toFixed(2)} in all. Plans that already exist are skipped, so it&apos;s safe to run again; run it once a month.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-soft">Stats key</span>
          <input type="password" className={`${inputClass} mt-1 w-72`} value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <button type="button" className={primaryButton} disabled={!key || running} onClick={runAll}>
          {running ? "Running…" : "Run all"}
        </button>
      </div>
      {done.length > 0 && (
        <p className="mt-4 text-sm text-ink">
          {made} new plans so far, ${cost.toFixed(2)} (₹{Math.round(cost * 88)}).
        </p>
      )}

      {MONTHS.map((month) => (
        <section key={month} className="mt-8">
          <h2 className="font-wide text-lg font-bold">{monthName(month)}</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
            {ORIGIN_AIRPORTS.map((a) => {
              const row = rows[id(a.code, month)] ?? { state: "idle" };
              return (
                <li key={a.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-28 font-semibold">{a.city}</span>
                  <span className="flex-1 text-soft">
                    {row.state === "idle" && "Not run yet"}
                    {row.state === "running" && (
                      <span className="inline-flex items-center gap-2">
                        <Spinner /> Writing plans (2–4 minutes)
                      </span>
                    )}
                    {row.state === "done" &&
                      `${row.r.made} new, ${row.r.skipped} already there${row.r.failed ? `, ${row.r.failed} failed` : ""} · $${row.r.costUsd.toFixed(3)}`}
                    {row.state === "error" && <span className="text-short-ink">{row.message}</span>}
                  </span>
                  {row.state === "done" && row.r.failed > 0 && (
                    <details className="w-full text-xs text-soft">
                      <summary className="cursor-pointer">Why some failed</summary>
                      <ul className="mt-1 list-disc pl-5">
                        {row.r.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
