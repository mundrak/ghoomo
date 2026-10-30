"use client";

import { useId, useRef, type ReactNode } from "react";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { CATEGORIES, CATEGORY_LABELS, inr, presetBudget, scaleBudget, sumBudget, TIER_INFO, tierPerDay } from "@/lib/budget";
import type { Diet, Interest, PartyType, StayType, Tier, TripInput } from "@/lib/types";
import { Chip, Dot, Segmented, SplitBar } from "./ui";

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
        className="inline-flex items-baseline border-b-[3px] border-signal px-0.5 font-extrabold transition peer-hover:bg-signal/25 peer-focus-visible:rounded-sm peer-focus-visible:bg-signal/40 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      >
        {children}
        <svg viewBox="0 0 12 8" className="ml-1.5 h-[0.22em] w-[0.34em] self-center text-soft" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
// The control is invisible but its dropdown is not: give it normal text size so the option list isn't headline-sized.
const overlay = "peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none text-base font-normal tracking-normal opacity-0";

export function TripForm({ value, onChange }: { value: TripInput; onChange: (next: TripInput) => void }) {
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
    <div>
      <h1 className="font-wide max-w-5xl text-[clamp(28px,3.8vw,46px)] font-bold leading-[1.3] tracking-tight text-ink">
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
              {ORIGIN_AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city}
                </option>
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
                set({ days, budget: scaleBudget(presetBudget(value.tier, days), total) });
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
        <Slot
          control={
            <button
              type="button"
              aria-label={`Budget ${inr(total)} per person. Change it with the slider`}
              className={overlay}
              onClick={() => sliderRef.current?.focus()}
            />
          }
        >
          {inr(total)}
        </Slot>
        {solo ? "." : " each."}
      </h1>
      <p className="mt-3 text-[15px] text-soft">Change anything underlined. The board below updates as you go.</p>

      <div className="mt-8 grid max-w-4xl gap-x-8 gap-y-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="min-w-36">
          <div className="text-[28px] font-extrabold tabular-nums leading-tight">{inr(total)}</div>
          <div className="text-sm text-soft">{solo ? "all in" : `each, ${inr(total * value.travellers)} for the group`}</div>
        </div>
        <div>
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
            className="track w-full"
            style={{ ["--fill" as string]: `${toPos(total) / 10}%` }}
          />
          <div className="mt-1 flex justify-between text-xs text-soft">
            <span>₹3,000</span>
            <span>₹30,000</span>
            <span>₹3,00,000</span>
          </div>
        </div>
        <div className="text-sm font-semibold text-soft">Travel style</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented<Tier>
            label="Travel style"
            value={value.tier}
            onChange={(tier) => set({ tier, budget: presetBudget(tier, value.days) })}
            options={(Object.keys(TIER_INFO) as Tier[]).map((t) => ({ id: t, label: TIER_INFO[t].label }))}
          />
          <span className="text-sm text-soft">
            {TIER_INFO[value.tier].blurb}, about {inr(tierPerDay(value.tier))} a day plus travel
          </span>
        </div>
      </div>

      <details className="group mt-7 max-w-4xl rounded-xl border-[1.5px] border-line bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-bold">Fine-tune</span>
            <span className="ml-2 text-sm text-soft">{finetuneSummary}</span>
          </span>
          <svg viewBox="0 0 12 8" className="h-2 w-3 shrink-0 text-soft transition group-open:rotate-180" aria-hidden="true">
            <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </summary>
        <div className="grid gap-6 border-t-[1.5px] border-line px-5 py-5 sm:grid-cols-2">
          <Group label="Where to stay">
            <Segmented<StayType> label="Where to stay" value={value.stay} onChange={(stay) => set({ stay })} options={STAYS} />
          </Group>
          {value.stay === "hotel" && (
            <Group label="People per room">
              <Segmented<"2" | "3" | "4">
                label="People per room"
                value={String(value.roomShare ?? 2) as "2" | "3" | "4"}
                onChange={(v) => set({ roomShare: Number(v) })}
                options={[
                  { id: "2", label: "2" },
                  { id: "3", label: "3, with an extra bed" },
                  { id: "4", label: "4" },
                ]}
              />
            </Group>
          )}
          <Group label="Where to look">
            <Segmented<TripInput["scope"]> label="Where to look" value={value.scope} onChange={(scope) => set({ scope })} options={SCOPES} />
          </Group>
          <Group label="What you eat">
            {DIETS.map((d) => (
              <Chip key={d.id} active={value.diet === d.id} onClick={() => set({ diet: d.id })}>
                {d.label}
              </Chip>
            ))}
          </Group>
          <Group label="What you're into">
            {INTERESTS.map((i) => (
              <Chip key={i.id} active={value.interests.includes(i.id)} onClick={() => set({ interests: toggle(value.interests, i.id) })}>
                {i.label}
              </Chip>
            ))}
          </Group>
          <Group label="Cuisines you love">
            {CUISINES.map((c) => (
              <Chip key={c} active={value.cuisines.includes(c)} onClick={() => set({ cuisines: toggle(value.cuisines, c) })}>
                {c}
              </Chip>
            ))}
          </Group>
          <div className="space-y-3 sm:col-span-2">
            <div className="text-sm font-semibold text-soft">How your {inr(total)} is split</div>
            <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: value.budget[c] }))} />
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="block text-sm text-soft">
                  <span className="flex justify-between">
                    <span className="inline-flex items-center gap-2">
                      <Dot category={c} /> {CATEGORY_LABELS[c]}
                    </span>
                    <span className="font-semibold tabular-nums text-ink">{inr(value.budget[c])}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={c === "flights" ? 100000 : 150000}
                    step={500}
                    value={value.budget[c]}
                    onChange={(e) => set({ budget: { ...value.budget, [c]: Number(e.target.value) } })}
                    className="mt-1 w-full accent-ink"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-sm font-semibold text-soft">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

export function defaultTrip(): TripInput {
  return {
    origin: "DEL",
    startDate: defaultStart(),
    days: 5,
    party: "students",
    travellers: 5,
    tier: "budget",
    budget: presetBudget("budget", 5),
    stay: "hostel",
    diet: "any",
    cuisines: [],
    interests: [],
    scope: "anywhere",
  };
}
