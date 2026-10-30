"use client";

import { useState } from "react";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { DESTINATIONS } from "@/data/destinations";
import { CATEGORIES, CATEGORY_LABELS, inr, presetBudget, sumBudget, TIER_INFO } from "@/lib/budget";
import type { CategoryBudget, Diet, Interest, PartyType, StayType, Tier, TripInput } from "@/lib/types";
import { Chip, inputClass, Section } from "./ui";

const PARTIES: { id: PartyType; label: string; size: number }[] = [
  { id: "solo", label: "Solo", size: 1 },
  { id: "couple", label: "Couple", size: 2 },
  { id: "students", label: "Student group", size: 5 },
  { id: "group", label: "Friends group", size: 5 },
];
const STAYS: { id: StayType; label: string }[] = [
  { id: "hostel", label: "Hostel" },
  { id: "hotel", label: "Hotel" },
  { id: "airbnb", label: "Airbnb / homestay" },
];
const DIETS: { id: Diet; label: string }[] = [
  { id: "any", label: "Eat anything" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "jain", label: "Jain" },
  { id: "vegan", label: "Vegan" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "halal", label: "Halal" },
];
const CUISINES = ["Indian", "Local food", "Street food", "Asian", "Chinese", "European", "Middle Eastern", "Cafés"];
const INTERESTS: Interest[] = ["beach", "mountains", "nightlife", "culture", "adventure", "food", "shopping", "nature"];

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function TripForm({ onSubmit, busy }: { onSubmit: (input: TripInput) => void; busy: boolean }) {
  const [origin, setOrigin] = useState("DEL");
  const [startDate, setStartDate] = useState(defaultStart);
  const [days, setDays] = useState(5);
  const [party, setParty] = useState<PartyType>("students");
  const [travellers, setTravellers] = useState(5);
  const [tier, setTier] = useState<Tier>("budget");
  const [budget, setBudget] = useState<CategoryBudget>(() => presetBudget("budget", 5));
  const [budgetEdited, setBudgetEdited] = useState(false);
  const [stay, setStay] = useState<StayType>("hostel");
  const [diet, setDiet] = useState<Diet>("vegetarian");
  const [cuisines, setCuisines] = useState<string[]>(["Indian", "Local food"]);
  const [interests, setInterests] = useState<Interest[]>(["beach", "nightlife", "adventure"]);
  const [mode, setMode] = useState<"suggest" | "pick">("suggest");
  const [scope, setScope] = useState<TripInput["scope"]>("anywhere");
  const [destinationId, setDestinationId] = useState(DESTINATIONS[0].id);

  // Tier and trip length re-apply the preset until the user edits the numbers themselves.
  const applyPreset = (t: Tier, d: number) => {
    if (!budgetEdited) setBudget(presetBudget(t, d));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      origin,
      startDate,
      days,
      party,
      travellers,
      tier,
      budget,
      stay,
      diet,
      cuisines,
      interests,
      scope,
      destinationId: mode === "pick" ? destinationId : undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="Who's going?">
        <div className="flex flex-wrap gap-2">
          {PARTIES.map((p) => (
            <Chip
              key={p.id}
              active={party === p.id}
              onClick={() => {
                setParty(p.id);
                setTravellers(p.size);
              }}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        {(party === "students" || party === "group") && (
          <label className="flex items-center gap-3 text-sm text-stone-700">
            How many people?
            <input
              type="number"
              min={3}
              max={12}
              value={travellers}
              onChange={(e) => setTravellers(Number(e.target.value))}
              className={`${inputClass} w-20`}
            />
          </label>
        )}
      </Section>

      <Section title="When and from where?">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm text-stone-600">
            Flying from
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass}>
              {ORIGIN_AIRPORTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.city} ({a.code})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-stone-600">
            Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
          </label>
          <label className="space-y-1 text-sm text-stone-600">
            Days
            <input
              type="number"
              min={2}
              max={21}
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDays(d);
                applyPreset(tier, d);
              }}
              className={inputClass}
            />
          </label>
        </div>
      </Section>

      <Section title="Travel style" hint="Sets a starting budget. You can change any number below.">
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(TIER_INFO) as Tier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTier(t);
                applyPreset(t, days);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                tier === t ? "border-teal-700 bg-teal-50 ring-2 ring-teal-700/20" : "border-stone-300 bg-white hover:border-stone-400"
              }`}
            >
              <div className="font-semibold text-stone-900">{TIER_INFO[t].label}</div>
              <div className="text-sm text-stone-500">{TIER_INFO[t].blurb}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Budget per person (₹)" hint={`Total: ${inr(sumBudget(budget))} per person · ${inr(sumBudget(budget) * travellers)} for the group`}>
        <div className="grid gap-3 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <label key={c} className="space-y-1 text-sm text-stone-600">
              {CATEGORY_LABELS[c]}
              <input
                type="number"
                min={0}
                step="any"
                value={budget[c]}
                onChange={(e) => {
                  setBudgetEdited(true);
                  setBudget({ ...budget, [c]: Number(e.target.value) });
                }}
                className={inputClass}
              />
            </label>
          ))}
        </div>
        {budgetEdited && (
          <button
            type="button"
            className="text-sm text-teal-700 underline"
            onClick={() => {
              setBudgetEdited(false);
              setBudget(presetBudget(tier, days));
            }}
          >
            Reset to {TIER_INFO[tier].label} preset
          </button>
        )}
      </Section>

      <Section title="Where do you want to stay?">
        <div className="flex flex-wrap gap-2">
          {STAYS.map((s) => (
            <Chip key={s.id} active={stay === s.id} onClick={() => setStay(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Food">
        <div className="flex flex-wrap gap-2">
          {DIETS.map((d) => (
            <Chip key={d.id} active={diet === d.id} onClick={() => setDiet(d.id)}>
              {d.label}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-stone-500">Cuisines you enjoy</p>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip key={c} active={cuisines.includes(c)} onClick={() => setCuisines(toggle(cuisines, c))}>
              {c}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="What are you into?">
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i} active={interests.includes(i)} onClick={() => setInterests(toggle(interests, i))}>
              <span className="capitalize">{i}</span>
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Destination">
        <div className="flex flex-wrap gap-2">
          <Chip active={mode === "suggest"} onClick={() => setMode("suggest")}>
            Suggest places for my budget
          </Chip>
          <Chip active={mode === "pick"} onClick={() => setMode("pick")}>
            I know where I want to go
          </Chip>
        </div>
        {mode === "suggest" ? (
          <div className="flex flex-wrap gap-2">
            {(["anywhere", "india", "abroad"] as const).map((s) => (
              <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
                {s === "anywhere" ? "Anywhere" : s === "india" ? "Within India" : "Abroad"}
              </Chip>
            ))}
          </div>
        ) : (
          <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className={`${inputClass} sm:w-80`}>
            {DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}, {d.country}
              </option>
            ))}
          </select>
        )}
      </Section>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Working…" : mode === "suggest" ? "Show me where I can go" : "Plan my trip"}
      </button>
    </form>
  );
}
