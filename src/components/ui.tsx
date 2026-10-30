"use client";

import type { ReactNode } from "react";

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold text-stone-900">{title}</h2>
        {hint && <p className="text-sm text-stone-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
      }`}
    >
      {children}
    </button>
  );
}

export function Badge({ live }: { live: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        live ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {live ? "Live price" : "Estimate"}
    </span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const over = used > limit;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-teal-600"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20";
