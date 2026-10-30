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

## Code map

- `src/data/destinations.ts`: the 15 starter destinations, with cost estimates, seasons, visa notes for Indian passports and a vegetarian-friendliness score
- `src/lib/budget.ts`: tier presets, the group cost model (shared rooms, shared cabs) and destination scoring
- `src/lib/providers/`: live flight and hotel prices, each falling back to estimates
- `src/lib/itinerary.ts`: Claude prompt, itinerary schema and the no-key template
- `src/app/api/suggest`, `src/app/api/itinerary`: the two endpoints
- `src/components/`: form, suggestion cards, itinerary + budget tracker

## Ideas for next
- Save and share trips with the group, plus split-the-bill per person
- Train and bus legs (IRCTC, redBus) for domestic trips
- More destinations, and cost data refreshed from live prices over time
- Student discounts (ISIC) and group deals
