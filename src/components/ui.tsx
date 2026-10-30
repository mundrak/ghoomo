"use client";

import type { ReactNode } from "react";
import type { Category } from "@/lib/types";

export const CATEGORY_STYLE: Record<Category, { icon: string; bar: string; dot: string }> = {
  flights: { icon: "✈️", bar: "bg-sky-500", dot: "bg-sky-500" },
  stay: { icon: "🛏️", bar: "bg-violet-500", dot: "bg-violet-500" },
  food: { icon: "🍽️", bar: "bg-amber-500", dot: "bg-amber-500" },
  activities: { icon: "🎟️", bar: "bg-rose-500", dot: "bg-rose-500" },
  transport: { icon: "🚕", bar: "bg-emerald-500", dot: "bg-emerald-500" },
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-stone-900">{label}</h3>
        {hint && <p className="text-sm text-stone-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** A big tappable card for single-choice options. */
export function OptionCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
        active ? "border-teal-600 bg-teal-50 shadow-sm" : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      {icon && <span className="text-2xl leading-none">{icon}</span>}
      <span className="min-w-0">
        <span className="block font-semibold text-stone-900">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-stone-500">{subtitle}</span>}
      </span>
    </button>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active ? "border-teal-600 bg-teal-600 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
      }`}
    >
      {children}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  const btn =
    "grid h-11 w-11 place-items-center rounded-full border border-stone-300 bg-white text-xl text-stone-700 transition hover:border-teal-600 disabled:opacity-40";
  return (
    <div className="inline-flex items-center gap-4">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${suffix}`}>
        −
      </button>
      <span className="min-w-20 text-center text-lg font-semibold text-stone-900">
        {value} {suffix}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${suffix}`}>
        +
      </button>
    </div>
  );
}

export function Badge({ live }: { live: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        live ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {live ? "Live price" : "Estimate"}
    </span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
      <div className={`h-full rounded-full ${used > limit ? "bg-rose-500" : "bg-teal-600"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One bar split into coloured segments, one per budget category. */
export function SplitBar({ parts }: { parts: { category: Category; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-stone-200">
      {parts.map((p) => (
        <div key={p.category} className={CATEGORY_STYLE[p.category].bar} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/15";
