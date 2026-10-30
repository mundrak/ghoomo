# ghoomo

A budget-first trip planner for Indian travellers, built mainly for students and friend groups of 4–6.

You say who's going, your dates, your travel style (Budget / Comfort / Luxury) and how much each person wants to spend on flights, stay, food, experiences and local transport. ghoomo then either:

- **suggests destinations** your budget actually covers, ranked by budget fit, season, interests and how easy it is to eat vegetarian; or
- **plans a trip** to the place you already picked.

Every plan comes with a day-by-day itinerary, booking links, and a live **budget tracker** that compares planned spend with your budget for each category. You can then change the plan by chatting ("make it cheaper", "swap day 3 for a beach day").

## Running it

```bash
npm install
cp .env.example .env.local   # add whichever keys you have
npm run dev                  # http://localhost:3000
```

Without any keys the app still works end to end, using estimates and a basic itinerary built from its own data.

## Where prices come from

| What | Source | Without a key |
|---|---|---|
| Flights | [Travelpayouts](https://www.travelpayouts.com) Aviasales Data API: recently seen fares in INR, with a link to book | Rough fare estimate + Skyscanner search link |
| Hotels | [LiteAPI](https://www.liteapi.travel): live, bookable hotel rates | Per-destination estimate + Booking.com search link |
| Hostels / Airbnb | No open API. Estimates + Hostelworld / Airbnb search links, pre-filled with your dates and group size | — |
| Itinerary | Claude (Anthropic API), structured JSON output | Template itinerary; editing by chat turned off |

Each price is labelled **Live price** or **Estimate** in the UI.

**Why not Skyscanner or Booking.com directly?** Both APIs are partner-only, and they approve established businesses with real traffic. Scraping them breaks their terms. Travelpayouts and LiteAPI are open to small projects, and both pay affiliate commission. Once ghoomo has users, applying to Skyscanner and Booking.com partner programmes is a realistic next step. The provider code in `src/lib/providers/` is set up so another source can be added there.

> The Travelpayouts and LiteAPI adapters were written against their public docs but haven't been tested with real keys yet. Check them first once you have keys.

## Keeping AI costs under control

AI itineraries are the only cost that grows with users. The app limits it:

- **Per visitor:** 3 AI plans and 10 AI edits per day. After that, visitors get the free starter plan.
- **Daily spend cap:** total AI spend stops at $2/day by default (worst case ~$60/month). After that, everyone gets starter plans until the next day.
- **Cache:** identical trip requests share one AI plan for 7 days.
- **Two models:** most trips are planned by Haiku 5.5 (`AI_STANDARD_MODEL`). Luxury, Jain and vegan trips get Opus 5.5 (`AI_PREMIUM_MODEL`), labelled "Planned by premium AI", up to $1/day (`AI_PREMIUM_DAILY_BUDGET_USD`). After that they fall back to Haiku for the day. Haiku is about 40× cheaper than Opus; in testing it missed Jain food rules (it suggested momos and aloo dishes), which is why those trips go to Opus.

All limits are environment variables (see `.env.example`). For them to hold on Vercel, connect a free Upstash Redis database: in the Vercel project, open **Storage → Create Database → Upstash (Redis)** and connect it to the project. Vercel adds the connection variables, and the app picks them up automatically.

Redis also switches on **saved trips** (share links like `/?trip=…`) and **group check-in** (`/?group=…`). Without it, both stay hidden and the plan page offers a WhatsApp share only. The home page is built ahead of time, so **redeploy after connecting Redis** for them to appear.

**Usage numbers.** ghoomo counts anonymous events per day (board shown, pass opened, plan shown, booking clicks, shares, group check-ins, and plan ratings with the reason when a plan wasn't useful). No IDs, IPs or trip details are stored with them. Set a `STATS_KEY` and open `/api/stats?key=<your key>` to read them. For page views and visitor counts, also turn on **Web Analytics** in the Vercel project (Analytics tab); the code is already in place.

To check what's switched on, open `/api/status` on the live site. It shows whether Redis is connected and answering, and which keys (AI, fares, hotel rates) are set, without showing any values. Any variable prefix from the Vercel integration works (`KV_`, `STORAGE_`, …).

Full numbers, suggested settings and how the app can pay for itself: [docs/ECONOMICS.md](docs/ECONOMICS.md).

## Code map

- `src/data/destinations.ts`: the 15 starter destinations, with cost estimates, seasons, visa notes for Indian passports and a vegetarian-friendliness score
- `src/lib/budget.ts`: tier presets, the group cost model (shared rooms, shared cabs) and destination scoring
- `src/lib/providers/`: live flight and hotel prices, each falling back to estimates
- `src/lib/itinerary.ts`: Claude prompt, itinerary schema, cost tracking and the starter-plan template
- `src/lib/limits.ts`: per-visitor limits, daily spend cap and itinerary cache
- `src/lib/validate.ts`: checks and size limits on incoming requests
- `src/app/api/suggest`, `src/app/api/itinerary`: the two endpoints
- `src/components/`: step-by-step trip form, suggestion cards, itinerary + budget tracker

## Ideas for next
- Save and share trips with the group, plus split-the-bill per person
- Train and bus legs (IRCTC, redBus) for domestic trips
- More destinations, and cost data refreshed from live prices over time
- Student discounts (ISIC) and group deals
