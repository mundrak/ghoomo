"use client";

import type { ReactNode } from "react";
import type { Category } from "@/lib/types";

// One colour per budget category, drawn from the brand palette.
export const CATEGORY_COLOR: Record<Category, string> = {
  flights: "bg-orange",
  stay: "bg-ink",
  food: "bg-gold",
  activities: "bg-[#f2a487]",
  transport: "bg-[#9db37d]",
};

export function Dot({ category }: { category: Category }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLOR[category]}`} />;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">{children}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-ink">{label}</h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** A tappable card for single-choice options. */
export function OptionCard({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative w-full rounded-2xl border-[1.5px] bg-white px-5 py-4 text-left transition ${
        active ? "border-ink shadow-[0_4px_18px_rgba(51,41,31,0.08)]" : "border-line hover:border-muted/50"
      }`}
    >
      <span className="block pr-6 font-semibold text-ink">{title}</span>
      {subtitle && <span className="mt-0.5 block text-sm leading-snug text-muted">{subtitle}</span>}
      <span
        className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border-[1.5px] text-[11px] text-white transition ${
          active ? "border-orange bg-orange" : "border-line"
        }`}
      >
        {active && "✓"}
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
      className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition ${
        active ? "border-ink bg-ink text-cream" : "border-line bg-white text-ink-soft hover:border-muted/50"
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
    "grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-line bg-white text-lg text-ink transition hover:border-ink disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${suffix}`}>
        −
      </button>
      <span className="min-w-20 text-center text-lg font-semibold tabular-nums text-ink">
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
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${live ? "bg-sage text-ink" : "bg-butter text-ink-soft"}`}>
      {live ? "live price" : "estimate"}
    </span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${used > limit ? "bg-orange" : "bg-ink"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One bar split into coloured segments, one per budget category. */
export function SplitBar({ parts }: { parts: { category: Category; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
      {parts.map((p) => (
        <div key={p.category} className={`${CATEGORY_COLOR[p.category]} rounded-full`} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-cream transition hover:bg-orange disabled:opacity-40 disabled:hover:bg-ink";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-full border-[1.5px] border-line bg-white px-5 py-3 font-semibold text-ink transition hover:border-ink";
export const textLink = "font-semibold text-ink underline decoration-mustard decoration-2 underline-offset-4 hover:text-orange";

export const inputClass =
  "w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-ink focus:border-ink focus:outline-none";
