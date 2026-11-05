# Trip Planner: single form, budget and 3-day preview

The holiday Trip Planner at `/trip-planner` is one form. Pressing **Generate my trip** saves the trip on the
server and opens it at `/trip-planner/t/<token>` (a long random token; no trip details are put in the
address). Visa, family and business plans keep the earlier step-by-step planner (`/trip-planner?for=visa` and so on).

## How a trip is made

1. **Form** (`src/lib/planner/trip/form.ts`): origin, destination (a country alone is fine), arrival and
   departure dates or arrival + days, party with child ages, budget and currency, and optional preferences.
   Days count the arrival and departure days; nights = days − 1.
2. **Itinerary** (`prompts.ts` → `ITINERARY_SYSTEM`, checked by `readItinerary` in `plan.ts`): route, bases
   and nights, days with morning/afternoon/evening items, alternatives, and the costs to look up.
3. **Prices** (`prompts.ts` → `PRICES_SYSTEM`, checked by `readPrices`): web research with sources. A price
   is kept only when its source address is one of the pages the searches returned; anything else is
   "unavailable" and the total is marked incomplete.
4. **Budget** (`calc.ts`): all arithmetic is in code: room rate × rooms × nights, tickets × adults and
   eligible children (free ages, family passes), meals × travellers per day (arrival/departure times and
   included breakfast respected), bookings counted once, sourced exchange rates, adjustable contingency.
5. **Access** (`gate.ts`, `store.ts`): unpaid visitors get the total, categories, route and days 1–3 (all
   days for trips of 3 days or fewer). Later days are never sent to the browser. Paid trips belong to the
   purchaser's account; the PDF (`/trip-planner/t/<token>/pdf`) needs full access.
6. **Payment** (`checkout.ts`): the existing Stripe checkout and the configured AI plan price
   (Community settings → Trip Planner → price). The trip unlocks only after the server confirms the
   session with Stripe (return page and webhook). An open checkout is reused, so nobody pays twice.

## Configuration

- `ANTHROPIC_API_KEY` and Community settings → Trip Planner → **AI enabled** (already used by the planner).
- Stripe keys and the webhook (already used for listings and AI plans). No new webhook events are needed.
- Run the migration `20261105_111932_trip_builder` (the Vercel build runs migrations).
- Optional, not built yet: a map provider (Google Maps Embed or Mapbox key) for a drawn map with markers. The
  Map tab currently lists numbered stops with Google Maps links and day directions.
- Optional, not built yet: flight and hotel provider APIs for date-specific quotes. Until then flight and
  hotel prices come from sourced web research and are labelled as estimates.

## Tests

- `npm run test:trip`: dates, form, price checks, budget arithmetic, changes and preview rules (no database).
- `TEST_DATABASE_URL=… node --import tsx --test --test-concurrency=1 tests/community/trip-builder.test.ts`:
  generation, failures and retries, the free allowance, gating, checkout and returning purchasers.
