"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { ZONE_LABELS, ZONES } from "@/lib/zones";
import { CATEGORIES, CATEGORY_LABELS, inr, presetBudget, presetTravel, scaleBudget, sumBudget, TIER_INFO, tierPerDay } from "@/lib/budget";
import type { Diet, Interest, PartyType, StayType, Tier, TripInput } from "@/lib/types";
import { Chip, Dot, Sec, Segmented, SplitBar } from "./ui";

const STAYS: { id: StayType; label: string }[] = [
  { id: "hostel", label: "Hostel" },
  { id: "hotel", label: "Hotel" },
  { id: "airbnb", label: "Airbnb or homestay" },
];
const DIETS: { id: Diet; label: string }[] = [
  { id: "any", label: "Anything" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "jain", label: "Jain" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "halal", label: "Halal" },
];
const CUISINES = ["Indian", "Local food", "Street food", "Asian", "Chinese", "European", "Middle Eastern", "Cafés"];
const INTERESTS: { id: Interest; label: string }[] = [
  { id: "beach", label: "Beaches" },
  { id: "mountains", label: "Mountains" },
  { id: "nightlife", label: "Nightlife" },
  { id: "culture", label: "Culture" },
  { id: "adventure", label: "Adventure" },
  { id: "food", label: "Food" },
  { id: "shopping", label: "Shopping" },
  { id: "nature", label: "Nature" },
];
const SCOPES: { id: TripInput["scope"]; label: string }[] = [
  { id: "anywhere", label: "Anywhere" },
  { id: "india", label: "Within India" },
  { id: "abroad", label: "Abroad" },
];

// Who's going, as one list so the sentence always reads naturally.
type Who = { party: PartyType; travellers: number; label: string };
const WHO: { group: string; options: Who[] }[] = [
  {
    group: "Small",
    options: [
      { party: "solo", travellers: 1, label: "Just me" },
      { party: "couple", travellers: 2, label: "A couple" },
    ],
  },
  { group: "Friends", options: Array.from({ length: 11 }, (_, i) => ({ party: "group" as const, travellers: i + 2, label: `${i + 2} friends` })) },
  { group: "Students", options: Array.from({ length: 11 }, (_, i) => ({ party: "students" as const, travellers: i + 2, label: `${i + 2} students` })) },
];
const whoKey = (party: PartyType, n: number) => `${party}:${n}`;

// The budget slider is curved so the student range (₹3k–30k) gets a third of the track instead of a sliver.
const MIN = 3000;
const MAX = 300000;
const toPos = (v: number) => Math.round(Math.sqrt(Math.min(Math.max((v - MIN) / (MAX - MIN), 0), 1)) * 1000);
const fromPos = (p: number) => {
  const raw = MIN + (MAX - MIN) * (p / 1000) ** 2;
  const step = raw < 50000 ? 500 : raw < 100000 ? 1000 : 5000;
  return Math.round(raw / step) * step;
};

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Underlined, tappable part of the sentence. The real control sits invisibly on top, so it stays accessible. */
function Slot({ children, control }: { children: ReactNode; control: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {control}
      <span
        aria-hidden="true"
        className="inline-flex items-baseline border-b-[1.5px] border-dotted border-faint transition-colors peer-hover:border-solid peer-hover:border-ink peer-focus-visible:rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
      >
        {children}
        <svg viewBox="0 0 12 8" className="ml-1 h-[0.18em] w-[0.3em] self-center text-faint" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
/**
 * The budget in the sentence: an amount you can click and type over. It looks like the other
 * underlined parts but has no dropdown arrow, because it isn't a list.
 */
function BudgetSlot({ total, onCommit }: { total: number; onCommit: (amount: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? total.toLocaleString("en-IN");
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/[^\d]/g, ""));
    if (n > 0) onCommit(Math.min(Math.max(Math.round(n / 100) * 100, MIN), MAX));
    setDraft(null);
  };
  return (
    <label className="inline-flex items-baseline whitespace-nowrap border-b-[1.5px] border-dotted border-faint transition-colors hover:border-solid hover:border-ink focus-within:border-solid focus-within:border-ink">
      <span aria-hidden="true">₹</span>
      {/* An invisible copy of the text sets the width, so the box always fits what's typed. */}
      <span className="relative inline-block">
        <span aria-hidden="true" className="invisible whitespace-pre tabular-nums">
          {shown || "0"}
        </span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Budget per person in rupees, between ${inr(MIN)} and ${inr(MAX)}`}
          value={shown}
          className="absolute inset-0 w-full cursor-text bg-transparent p-0 font-semibold tabular-nums text-ink outline-none focus-visible:outline-none"
          onFocus={(e) => {
            setDraft(String(total));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
            }
          }}
        />
      </span>
      <svg viewBox="0 0 16 16" className="ml-1 h-[0.26em] w-[0.26em] self-center text-faint" aria-hidden="true">
        <path d="M11 2.5 13.5 5 6 12.5 3 13l.5-3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

// The control is invisible but its dropdown is not: give it normal text size so the option list isn't headline-sized.
const overlay = "peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none text-base font-normal tracking-normal opacity-0";

export function TripForm({ value, onChange, status }: { value: TripInput; onChange: (next: TripInput) => void; status?: ReactNode }) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const set = (patch: Partial<TripInput>) => onChange({ ...value, ...patch });
  const total = sumBudget(value.budget);
  const city = ORIGIN_AIRPORTS.find((a) => a.code === value.origin)?.city ?? value.origin;
  const solo = value.travellers === 1;
  const whoLabel = WHO.flatMap((g) => g.options).find((o) => o.party === value.party && o.travellers === value.travellers)?.label ?? `${value.travellers} friends`;

  const finetuneSummary = [
    STAYS.find((s) => s.id === value.stay)?.label,
    value.diet === "any" ? "any food" : DIETS.find((d) => d.id === value.diet)?.label.toLowerCase(),
    value.interests.length ? `${value.interests.length} interest${value.interests.length > 1 ? "s" : ""}` : null,
    SCOPES.find((s) => s.id === value.scope)?.label.toLowerCase(),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-col gap-3.5">
      <h1 className="text-[clamp(26px,6vw,40px)] font-semibold leading-[1.35] tracking-[-0.03em] text-ink">
        {!solo && "We're "}
        <Slot
          control={
            <select
              aria-label="Who's going"
              className={overlay}
              value={whoKey(value.party, value.travellers)}
              onChange={(e) => {
                const [party, n] = e.target.value.split(":");
                set({ party: party as PartyType, travellers: Number(n) });
              }}
            >
              {WHO.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => (
                    <option key={whoKey(o.party, o.travellers)} value={whoKey(o.party, o.travellers)}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          }
        >
          {solo ? "Just me" : whoLabel.replace("A couple", "a couple")}
        </Slot>
        {solo ? ", leaving " : " leaving "}
        <Slot
          control={
            <select aria-label="Leaving from" className={overlay} value={value.origin} onChange={(e) => set({ origin: e.target.value })}>
              {ZONES.map((z) => (
                <optgroup key={z} label={ZONE_LABELS[z]}>
                  {ORIGIN_AIRPORTS.filter((a) => a.zone === z)
                    .sort((x, y) => x.city.localeCompare(y.city))
                    .map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.city}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          }
        >
          {city}
        </Slot>{" "}
        on{" "}
        <Slot
          control={
            <input
              type="date"
              aria-label="Leaving on"
              className={overlay}
              value={value.startDate}
              min={new Date().toISOString().slice(0, 10)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // Some browsers only open the picker from their own icon; the input still works by keyboard.
                }
              }}
              onChange={(e) => e.target.value && set({ startDate: e.target.value })}
            />
          }
        >
          {shortDate(value.startDate)}
        </Slot>{" "}
        for{" "}
        <Slot
          control={
            <select
              aria-label="Trip length"
              className={overlay}
              value={value.days}
              onChange={(e) => {
                const days = Number(e.target.value);
                // Keep the amount they chose; just re-split it for the new length.
                set({ days, budget: scaleBudget(presetBudget(value.tier, days, value.scope), total) });
              }}
            >
              {Array.from({ length: 13 }, (_, i) => i + 2).map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          }
        >
          {value.days} days
        </Slot>
        , with{" "}
        <BudgetSlot total={total} onCommit={(amount) => set({ budget: scaleBudget(value.budget, amount) })} />
        {solo ? "." : " each."}
      </h1>
      <p className="text-[clamp(15px,3vw,17px)] tracking-[-0.01em] text-soft">Change anything underlined, or type a budget. The places below update as you go.</p>
      {status}
      </header>

      <div className="flex flex-col gap-12">
        <Sec label="budget">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{inr(total)}</span>
            <span className="font-mono text-xs text-faint">{solo ? "all in" : `each · ${inr(total * value.travellers)} for the group`}</span>
          </div>
          <label htmlFor={`${ids}-budget`} className="sr-only">
            Budget per person
          </label>
          <input
            ref={sliderRef}
            id={`${ids}-budget`}
            type="range"
            min={0}
            max={1000}
            step={1}
            value={toPos(total)}
            aria-valuetext={`${inr(total)} per person`}
            onChange={(e) => set({ budget: scaleBudget(value.budget, fromPos(Number(e.target.value))) })}
            className="track mt-4 w-full"
            style={{ ["--fill" as string]: `${toPos(total) / 10}%` }}
          />
          <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
            <span>₹3k</span>
            <span>₹30k</span>
            <span>₹3L</span>
          </div>
        </Sec>

        <Sec label="style">
          <Segmented<Tier>
            label="Travel style"
            value={value.tier}
            onChange={(tier) => set({ tier, budget: presetBudget(tier, value.days, value.scope) })}
            options={(Object.keys(TIER_INFO) as Tier[]).map((t) => ({ id: t, label: TIER_INFO[t].label }))}
          />
          <p className="mt-2.5 text-sm text-soft">
            {TIER_INFO[value.tier].blurb}, about {inr(tierPerDay(value.tier))} a day plus travel.
          </p>
        </Sec>

        <Sec label="fine-tune">
          <details className="group">
            <summary className="-mx-3 flex cursor-pointer list-none items-baseline justify-between gap-4 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-row [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="font-medium">Stay, food, interests, where</span>
                <span className="block text-sm text-soft">{finetuneSummary}</span>
              </span>
              <span className="font-mono text-xs text-faint">
                <span className="group-open:hidden">open +</span>
                <span className="hidden group-open:inline">close −</span>
              </span>
            </summary>
            <div className="animate-open mt-4 flex flex-col gap-6">
              <Group label="where to stay">
                <Segmented<StayType> label="Where to stay" value={value.stay} onChange={(stay) => set({ stay })} options={STAYS} />
              </Group>
              {value.stay === "hotel" && (
                <Group label="people per room">
                  <Segmented<"2" | "3" | "4">
                    label="People per room"
                    value={String(value.roomShare ?? 2) as "2" | "3" | "4"}
                    onChange={(v) => set({ roomShare: Number(v) })}
                    options={[
                      { id: "2", label: "2" },
                      { id: "3", label: "3, extra bed" },
                      { id: "4", label: "4" },
                    ]}
                  />
                </Group>
              )}
              <Group label="where to look">
                <Segmented<TripInput["scope"]>
                  label="Where to look"
                  value={value.scope}
                  onChange={(scope) =>
                    // Switching to or from abroad resets "getting there" to that scope's default.
                    set({ scope, budget: { ...value.budget, flights: presetTravel(value.tier, scope) } })
                  }
                  options={SCOPES}
                />
              </Group>
              <Group label="what you eat">
                {DIETS.map((d) => (
                  <Chip key={d.id} active={value.diet === d.id} onClick={() => set({ diet: d.id })}>
                    {d.label}
                  </Chip>
                ))}
              </Group>
              <Group label="what you're into">
                {INTERESTS.map((i) => (
                  <Chip key={i.id} active={value.interests.includes(i.id)} onClick={() => set({ interests: toggle(value.interests, i.id) })}>
                    {i.label}
                  </Chip>
                ))}
              </Group>
              <Group label="cuisines you love">
                {CUISINES.map((c) => (
                  <Chip key={c} active={value.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(value.cuisines, c) })}>
                    {c}
                  </Chip>
                ))}
              </Group>
              <div className="space-y-3">
                <div className="font-mono text-xs text-faint">how your {inr(total)} is split</div>
                <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: value.budget[c] }))} />
                <div className="grid gap-x-8 gap-y-4 pt-1 sm:grid-cols-2">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="block text-sm text-soft">
                      <span className="flex justify-between">
                        <span className="inline-flex items-center gap-2">
                          <Dot category={c} /> {CATEGORY_LABELS[c]}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-ink">{inr(value.budget[c])}</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={c === "flights" ? 100000 : 150000}
                        step={500}
                        value={value.budget[c]}
                        onChange={(e) => set({ budget: { ...value.budget, [c]: Number(e.target.value) } })}
                        className="track mt-3 w-full"
                        style={{ ["--fill" as string]: `${(value.budget[c] / (c === "flights" ? 100000 : 150000)) * 100}%` }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </Sec>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-xs text-faint">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export { defaultTrip } from "@/lib/defaults";
