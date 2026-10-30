# Running costs and how ghoomo stays cheap

The only cost that grows with users is the AI that writes itineraries. Everything else runs on free tiers. This page covers what each part costs, the guards that cap spend, and how the app can pay for itself.

> Token counts below are estimates. Once a real Anthropic key is set, every AI call logs its actual tokens and cost (`[ai] plan model=… in=… out=… cost=$…` in Vercel's logs). Replace these numbers with real ones after the first week.

## What costs money

| Part | Cost | Notes |
|---|---|---|
| Hosting (Vercel Hobby) | Free | Fine while non-commercial. Pro is $20/month once the app earns money. |
| Usage counters + cache (Upstash Redis) | Free | The free tier is far more than a side project needs. Each AI request uses ~5 commands. |
| Flight prices (Travelpayouts) | Free | Pays *you* commission. |
| Hotel prices (LiteAPI) | Free to search | Pays commission on bookings. |
| Destination suggestions | Free | Ranked by our own code: no AI involved. |
| **AI itineraries (Claude)** | **Per use** | See below. |
| Domain name (optional) | ~₹800/year | `ghoomo.vercel.app` works without one. |

## AI cost per itinerary

Estimated with roughly 2,000 input and 5,000 output tokens per new plan (output includes the model's thinking), and ₹88 per US$:

| Model (`CLAUDE_MODEL`) | Price per M tokens (in / out) | One new plan | One edit | 1,000 plans |
|---|---|---|---|---|
| `claude-opus-5-5` (default) | $4 / $20 | ~$0.11 (₹9) | ~$0.08 (₹7) | ~$110 (₹9,700) |
| `claude-sonnet-5-5` | $2 / $10 | ~$0.05 (₹4.5) | ~$0.04 (₹3.5) | ~$55 (₹4,800) |
| `claude-haiku-5-5` | $0.10 / $0.50 | ~$0.003 (₹0.25) | ~$0.002 (₹0.2) | ~$3 (₹260) |

Switching model is one environment variable on Vercel. The real decision is quality, so try the same five trips on each model and compare before choosing.

## The guards that cap your bill

All of these are environment variables, so you can change them on Vercel without touching code:

| Guard | Default | What it does |
|---|---|---|
| `AI_PLANS_PER_VISITOR` | 3 per day | New AI itineraries per visitor (by hashed IP). After that, they get the free starter plan. |
| `AI_EDITS_PER_VISITOR` | 10 per day | "Change the plan" requests per visitor. |
| `AI_DAILY_BUDGET_USD` | $2 per day | Total AI spend across everyone. When reached, the AI pauses until midnight UTC and everyone gets starter plans. **Worst case: ~$60 (₹5,300)/month.** |
| Cache | 7 days | Two people asking for the same trip (same place, month, group, style and budget to the nearest ₹1,000) share one AI plan, so the second is free. |
| Request size limits | — | Trips up to 14 days, edits up to 300 characters, no oversized requests. Stops one request from burning lots of tokens. |
| Edits at low effort | — | Edits are smaller jobs than new plans, so they use less thinking. |
| Failed calls are free | — | If the AI fails, the visitor isn't charged a plan and still gets a starter itinerary. |

**Also set a monthly spend limit in the Anthropic Console** (Settings → Limits). That's the hard backstop if anything in the app misbehaves.

The counters need Redis to work properly on Vercel. Without it they live in each server instance's memory, and Vercel spins instances up and down, so the limits leak. Set-up is in the README.

## Suggested settings by stage

| Stage | Model | `AI_DAILY_BUDGET_USD` | Max per month |
|---|---|---|---|
| Testing with friends | Opus 5.5 | 0.5 | ~$15 (₹1,300) |
| Public beta | Sonnet 5.5 or Haiku 5.5, whichever passes your quality check | 1–2 | $30–60 |
| Growing | Cheapest model that passes, with caching | Set from commission income | — |

## How it can pay for itself

Booking links carry affiliate tracking, so you earn when people book:

- **Flights (Travelpayouts / Aviasales):** roughly 1.1–1.5% of the booking. *These are indicative rates from third-party listings; check your Travelpayouts dashboard for actual terms.*
- **Hotels (Travelpayouts / LiteAPI):** roughly 4–5% of the booking.

**Example:** one group of 5 books return flights at ₹15,000 each (₹75,000 in total). At 1.2% that's about **₹900**, which pays for roughly 100 Opus plans or over 3,000 Haiku plans. So if even 1 in 100 Opus users (or 1 in 3,000 Haiku users) books through the app, the AI pays for itself. Real conversion rates are unknown until there are users.

Later options, once people use it:
- **Paid extras** (e.g. ₹99 per trip): unlimited edits, PDF export, sharing the plan with the group, splitting costs.
- **Higher limits for signed-in users**, which also stops people getting around limits by switching networks.
- **Partner listings** from hostels or tour operators, clearly labelled.
