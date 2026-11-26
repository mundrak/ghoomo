"use client";

import { useEffect, useState, type ReactNode } from "react";
import { THEME_KEY } from "@/lib/theme";
import type { Category, Destination, TravelMode } from "@/lib/types";

// Budget categories as shades of ink (see globals.css), from flights (darkest) to local transport.
export const CATEGORY_COLOR: Record<Category, string> = {
  flights: "bg-cat-flights",
  stay: "bg-cat-stay",
  food: "bg-cat-food",
  activities: "bg-cat-activities",
  transport: "bg-cat-transport",
};

export function Dot({ category }: { category: Category }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLOR[category]}`} />;
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

/**
 * A section of the page: a small mono label on the left, its rows on the right. Sized by the column it
 * sits in (a CSS container), so in a narrow column, or on a phone, the label stacks above the rows.
 */
export function Sec({ label, children, id, className = "" }: { label: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`grid gap-x-6 gap-y-1.5 @xl:grid-cols-[104px_minmax(0,1fr)] ${className}`}>
      <h2 className="font-mono text-xs font-normal text-faint @xl:pt-2.5">{label}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** One line in a section: title and a mono note on the first line, detail below. */
export const rowClass = "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 rounded-[10px] px-3 py-2.5 transition-colors";
export const rowsClass = "-mx-3 flex flex-col";
export const rowNote = "font-mono text-xs whitespace-nowrap text-faint tabular-nums";

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-[13.5px] transition-colors ${active ? "bg-ink text-bg" : "bg-row text-ink hover:bg-line"}`}
    >
      {children}
    </button>
  );
}

/** A row of mutually exclusive options, like the focus/fun switch on the portfolio. */
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
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-[18px] bg-row p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3.5 text-[13px] font-medium leading-[28px] transition-colors ${
            value === o.id ? "bg-bg text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-faint hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Says where a price came from. Flight fares from the provider are recently seen fares, not a live booking quote. */
export function PriceSource({ kind, live }: { kind: "flight" | "stay" | "travel"; live: boolean }) {
  const text = live ? (kind === "stay" ? "live rate" : "recent fare") : "estimate";
  return <span className={`font-mono text-[11px] ${live ? "text-ink" : "text-faint"}`}>{text}</span>;
}

/** A small pill with a pulsing dot, like the "probably on chai #2" status on the portfolio. */
export function StatusPill({ children, live = true }: { children: ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2.5 self-start rounded-full bg-row py-1.5 pl-2.5 pr-3 text-[13px] text-ink">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${live ? "animate-pulse-ring bg-ink" : "bg-faint"}`} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${used > limit ? "bg-faint" : "bg-ink"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One bar split into segments, one per budget category. */
export function SplitBar({ parts }: { parts: { category: Category; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full">
      {parts.map((p) => (
        <div key={p.category} className={CATEGORY_COLOR[p.category]} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />;
}

/** Switches between light and dark, and remembers the choice in this browser. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const set = document.documentElement.getAttribute("data-theme");
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        setDark(!dark);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // Storage blocked: the switch still works for this visit.
        }
      }}
      className="grid h-[34px] w-[34px] place-items-center rounded-full bg-row text-soft transition-colors hover:text-ink"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}

const icon = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function PlaneIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...icon} className={className}>
      <path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7H9l2-7H7l-2 2H2l2-4-2-4h3l2 2h4L9 3h3z" />
    </svg>
  );
}

export function TrainIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...icon} className={className}>
      <path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
      <path d="M7 6.5h10v4H7zM8 20.5l1.5-3.5M16 20.5 14.5 17M6 20.5h12" />
    </svg>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...icon} className={className}>
      <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function RoadIcon({ className = "" }: { className?: string }) {
  return (
    <svg {...icon} className={className}>
      <path d="M3 17V7a2 2 0 0 1 2-2h12.5a2 2 0 0 1 1.8 1.1L21 10v7h-2.2M5 17H3M9 17h6" />
      <path d="M3 10h18" />
      <circle cx="7" cy="17.5" r="1.9" />
      <circle cx="17" cy="17.5" r="1.9" />
    </svg>
  );
}

/** The icon for how you're getting there. */
export function ModeIcon({ mode, className = "" }: { mode: TravelMode; className?: string }) {
  if (mode === "train") return <TrainIcon className={className} />;
  if (mode === "bus") return <RoadIcon className={className} />;
  if (mode === "none") return <PinIcon className={className} />;
  return <PlaneIcon className={className} />;
}

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-40";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-row px-3.5 py-1.5 text-[13.5px] text-ink transition-colors hover:bg-line";
export const textLink = "text-soft underline decoration-line decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink";

export const inputClass =
  "w-full rounded-[10px] border border-transparent bg-row px-3 py-2 text-ink placeholder:text-faint focus:border-ink focus:outline-none";
