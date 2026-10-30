"use client";

import type { ReactNode } from "react";
import type { Category, Destination } from "@/lib/types";

// One colour per budget category. Flights use ink so the biggest cost reads as the anchor.
export const CATEGORY_COLOR: Record<Category, string> = {
  flights: "bg-ink",
  stay: "bg-cat-stay",
  food: "bg-cat-food",
  activities: "bg-cat-activities",
  transport: "bg-cat-transport",
};

export function Dot({ category }: { category: Category }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] ${CATEGORY_COLOR[category]}`} />;
}

/** The place's name in its local script, when it has one. */
export function LocalName({ d, className = "" }: { d: Destination; className?: string }) {
  if (!d.localName) return null;
  return (
    <span lang={d.localLang} dir="auto" className={`font-[family-name:var(--font-script)] font-semibold ${className}`}>
      {d.localName}
    </span>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border-[1.5px] px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-soft hover:border-soft"
      }`}
    >
      {children}
    </button>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border-[1.5px] border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${value === o.id ? "bg-ink text-white" : "text-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Says where a price came from. Flight fares from the provider are recently seen fares, not a live booking quote. */
export function PriceSource({ kind, live }: { kind: "flight" | "stay"; live: boolean }) {
  const text = live ? (kind === "flight" ? "recent fare" : "live rate") : "estimate";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${live ? "bg-go/15 text-go-ink" : "bg-line text-soft"}`}>{text}</span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${used > limit ? "bg-short-ink" : "bg-ink"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One bar split into coloured segments, one per budget category. */
export function SplitBar({ parts }: { parts: { category: Category; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
      {parts.map((p) => (
        <div key={p.category} className={CATEGORY_COLOR[p.category]} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function PlaneIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7H9l2-7H7l-2 2H2l2-4-2-4h3l2 2h4L9 3h3z" />
    </svg>
  );
}

export function RoadIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 17V7a2 2 0 0 1 2-2h12.5a2 2 0 0 1 1.8 1.1L21 10v7h-2.2M5 17H3M9 17h6" />
      <path d="M3 10h18M8 5v5M13 5v5" />
      <circle cx="7" cy="17.5" r="1.9" />
      <circle cx="17" cy="17.5" r="1.9" />
    </svg>
  );
}

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 font-semibold text-white transition hover:bg-board-raised disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-4 py-2.5 font-semibold text-ink transition hover:border-ink";
export const textLink = "font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink";

export const inputClass =
  "w-full rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-ink focus:border-ink focus:outline-none";
