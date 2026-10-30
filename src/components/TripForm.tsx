"use client";

import { useState } from "react";
import { ORIGIN_AIRPORTS } from "@/data/airports";
import { DESTINATIONS } from "@/data/destinations";
import { CATEGORIES, CATEGORY_LABELS, inr, presetBudget, scaleBudget, sumBudget, TIER_INFO, tierPerDay } from "@/lib/budget";
import type { CategoryBudget, Diet, Interest, PartyType, StayType, Tier, TripInput } from "@/lib/types";
import { CATEGORY_STYLE, Chip, Field, inputClass, OptionCard, SplitBar, Stepper } from "./ui";

const PARTIES: { id: PartyType; icon: string; label: string; sub: string; size: number }[] = [
  { id: "students", icon: "🎓", label: "Student group", sub: "Hostels, deals, max fun", size: 5 },
  { id: "group", icon: "👯", label: "Friends group", sub: "Split stays and cabs", size: 5 },
  { id: "couple", icon: "💑", label: "Couple", sub: "Two of you", size: 2 },
  { id: "solo", icon: "🎒", label: "Solo", sub: "Just you", size: 1 },
];
const TIER_ICONS: Record<Tier, string> = { budget: "🪙", comfort: "✨", luxury: "💎" };
const STAYS: { id: StayType; icon: string; label: string; sub: string }[] = [
  { id: "hostel", icon: "🛏️", label: "Hostel", sub: "Cheapest, social" },
  { id: "hotel", icon: "🏨", label: "Hotel", sub: "Rooms for two" },
  { id: "airbnb", icon: "🏡", label: "Airbnb / homestay", sub: "Whole place for the group" },
];
const DIETS: { id: Diet; label: string }[] = [
  { id: "any", label: "🍗 Anything" },
  { id: "vegetarian", label: "🥗 Vegetarian" },
  { id: "jain", label: "🌿 Jain" },
  { id: "vegan", label: "🌱 Vegan" },
  { id: "eggetarian", label: "🥚 Eggetarian" },
  { id: "halal", label: "🥙 Halal" },
];
const CUISINES = ["Indian", "Local food", "Street food", "Asian", "Chinese", "European", "Middle Eastern", "Cafés"];
const INTERESTS: { id: Interest; label: string }[] = [
  { id: "beach", label: "🏖️ Beaches" },
  { id: "mountains", label: "🏔️ Mountains" },
  { id: "nightlife", label: "🎉 Nightlife" },
  { id: "culture", label: "🏛️ Culture" },
  { id: "adventure", label: "🪂 Adventure" },
  { id: "food", label: "🍜 Food" },
  { id: "shopping", label: "🛍️ Shopping" },
  { id: "nature", label: "🌿 Nature" },
];
const STEPS = ["Who & when", "Budget", "Preferences", "Destination"];

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};
const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function TripForm({ onSubmit, busy, initial }: { onSubmit: (input: TripInput) => void; busy: boolean; initial?: TripInput | null }) {
  const [step, setStep] = useState(0);
  const [party, setParty] = useState<PartyType>(initial?.party ?? "students");
  const [travellers, setTravellers] = useState(initial?.travellers ?? 5);
  const [origin, setOrigin] = useState(initial?.origin ?? "DEL");
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultStart);
  const [days, setDays] = useState(initial?.days ?? 5);
  const [tier, setTier] = useState<Tier>(initial?.tier ?? "budget");
  const [budget, setBudget] = useState<CategoryBudget>(() => initial?.budget ?? presetBudget("budget", 5));
  const [customSplit, setCustomSplit] = useState(false);
  const [stay, setStay] = useState<StayType>(initial?.stay ?? "hostel");
  const [diet, setDiet] = useState<Diet>(initial?.diet ?? "vegetarian");
  const [cuisines, setCuisines] = useState<string[]>(initial?.cuisines ?? ["Indian", "Local food"]);
  const [interests, setInterests] = useState<Interest[]>(initial?.interests ?? ["beach", "nightlife", "adventure"]);
  const [mode, setMode] = useState<"suggest" | "pick">(initial?.destinationId ? "pick" : "suggest");
  const [scope, setScope] = useState<TripInput["scope"]>(initial?.scope ?? "anywhere");
  const [destinationId, setDestinationId] = useState<string | null>(initial?.destinationId ?? null);

  const total = sumBudget(budget);
  const isGroup = party === "students" || party === "group";

  // Changing the style or trip length starts the budget again from that style's preset.
  const reset = (t: Tier, d: number) => setBudget(presetBudget(t, d));

  const submit = () =>
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
      destinationId: mode === "pick" && destinationId ? destinationId : undefined,
    });

  const canContinue = step !== 3 || mode === "suggest" || destinationId !== null;
  const last = step === STEPS.length - 1;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-teal-600" : "bg-stone-200"}`} />
              <span className={`mt-2 hidden text-xs font-medium sm:block ${i === step ? "text-teal-700" : "text-stone-500"}`}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="mb-6 text-xl font-bold text-stone-900 sm:text-2xl">{
          ["Who's travelling, and when?", "How much do you want to spend?", "What's your travel style?", "Where to?"][step]
        }</h2>

        {step === 0 && (
          <div className="space-y-8">
            <Field label="Who's going?">
              <div className="grid gap-3 sm:grid-cols-2">
                {PARTIES.map((p) => (
                  <OptionCard
                    key={p.id}
                    active={party === p.id}
                    onClick={() => {
                      setParty(p.id);
                      setTravellers(p.size);
                    }}
                    icon={p.icon}
                    title={p.label}
                    subtitle={p.sub}
                  />
                ))}
              </div>
              {isGroup && (
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <span className="text-sm text-stone-600">How many of you?</span>
                  <Stepper value={travellers} onChange={setTravellers} min={3} max={12} suffix="people" />
                </div>
              )}
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Flying from">
                <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass}>
                  {ORIGIN_AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.city} ({a.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Leaving on">
                <input
                  type="date"
                  value={startDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => e.target.value && setStartDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="How long?">
              <div className="flex flex-wrap items-center gap-3">
                <Stepper
                  value={days}
                  onChange={(d) => {
                    setDays(d);
                    reset(tier, d);
                  }}
                  min={2}
                  max={14}
                  suffix="days"
                />
                <div className="flex flex-wrap gap-2">
                  {[3, 5, 7, 10].map((d) => (
                    <Chip
                      key={d}
                      active={days === d}
                      onClick={() => {
                        setDays(d);
                        reset(tier, d);
                      }}
                    >
                      {d === 3 ? "Long weekend" : `${d} days`}
                    </Chip>
                  ))}
                </div>
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(TIER_INFO) as Tier[]).map((t) => (
                <OptionCard
                  key={t}
                  active={tier === t}
                  onClick={() => {
                    setTier(t);
                    reset(t, days);
                  }}
                  icon={TIER_ICONS[t]}
                  title={TIER_INFO[t].label}
                  subtitle={`${TIER_INFO[t].blurb}. About ${inr(tierPerDay(t))}/day + flights`}
                />
              ))}
            </div>

            <div className="rounded-2xl bg-stone-50 p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm text-stone-500">Budget per person, everything included</div>
                  <div className="text-3xl font-bold text-stone-900">{inr(total)}</div>
                </div>
                {travellers > 1 && <div className="text-sm text-stone-500">{inr(total * travellers)} for all {travellers}</div>}
              </div>
              <input
                type="range"
                min={5000}
                max={300000}
                step={1000}
                value={Math.min(total, 300000)}
                onChange={(e) => setBudget(scaleBudget(budget, Number(e.target.value)))}
                className="mt-4 w-full accent-teal-600"
                aria-label="Budget per person"
              />
              <div className="flex justify-between text-xs text-stone-400">
                <span>₹5,000</span>
                <span>₹3,00,000</span>
              </div>

              <div className="mt-5 space-y-2">
                <SplitBar parts={CATEGORIES.map((c) => ({ category: c, value: budget[c] }))} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                  {CATEGORIES.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLE[c].dot}`} />
                      {CATEGORY_LABELS[c]} {inr(budget[c])}
                    </span>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => setCustomSplit(!customSplit)} className="mt-4 text-sm font-medium text-teal-700 underline">
                {customSplit ? "Hide split" : "Adjust how it's split"}
              </button>
              {customSplit && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="block text-sm text-stone-700">
                      <span className="flex justify-between">
                        <span>
                          {CATEGORY_STYLE[c].icon} {CATEGORY_LABELS[c]}
                        </span>
                        <span className="font-medium">{inr(budget[c])}</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={c === "flights" ? 100000 : 150000}
                        step={500}
                        value={budget[c]}
                        onChange={(e) => setBudget({ ...budget, [c]: Number(e.target.value) })}
                        className="w-full accent-teal-600"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <Field label="Where do you want to stay?">
              <div className="grid gap-3 sm:grid-cols-3">
                {STAYS.map((s) => (
                  <OptionCard key={s.id} active={stay === s.id} onClick={() => setStay(s.id)} icon={s.icon} title={s.label} subtitle={s.sub} />
                ))}
              </div>
            </Field>
            <Field label="What do you eat?" hint="We'll make sure there's food for everyone.">
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <Chip key={d.id} active={diet === d.id} onClick={() => setDiet(d.id)}>
                    {d.label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Cuisines you love" hint="Pick any.">
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => (
                  <Chip key={c} active={cuisines.includes(c)} onClick={() => setCuisines(toggle(cuisines, c))}>
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="What are you into?" hint="Pick a few. We'll plan around them.">
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <Chip key={i.id} active={interests.includes(i.id)} onClick={() => setInterests(toggle(interests, i.id))}>
                    {i.label}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                active={mode === "suggest"}
                onClick={() => setMode("suggest")}
                icon="🧭"
                title="Suggest places for me"
                subtitle="See where your budget can take you"
              />
              <OptionCard
                active={mode === "pick"}
                onClick={() => setMode("pick")}
                icon="📍"
                title="I know where I'm going"
                subtitle="Pick a destination"
              />
            </div>

            {mode === "suggest" ? (
              <Field label="Anywhere in particular?">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["anywhere", "🌏 Anywhere"],
                      ["india", "🇮🇳 Within India"],
                      ["abroad", "✈️ Abroad"],
                    ] as const
                  ).map(([id, label]) => (
                    <Chip key={id} active={scope === id} onClick={() => setScope(id)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {DESTINATIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDestinationId(d.id)}
                    aria-pressed={destinationId === d.id}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      destinationId === d.id ? "border-teal-600 bg-teal-50" : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <span className="text-2xl">{d.emoji}</span>
                    <span className="mt-1 block text-sm font-semibold leading-tight text-stone-900">{d.name}</span>
                    <span className="block text-xs text-stone-500">{d.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: summary + navigation */}
      <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-[#faf8f5]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-sm text-stone-600 sm:block">
            {PARTIES.find((p) => p.id === party)?.icon} {travellers} {travellers === 1 ? "person" : "people"} · {days} days ·{" "}
            {inr(total)}/person
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-xl border border-stone-300 bg-white px-5 py-3 font-medium text-stone-700 hover:border-stone-400"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={busy || !canContinue}
              onClick={() => (last ? submit() : setStep(step + 1))}
              className="flex-1 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 sm:flex-none"
            >
              {!last ? "Continue" : mode === "suggest" ? "Show me where I can go →" : destinationId ? "Plan my trip →" : "Pick a destination"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
