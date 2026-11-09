# Trip Planner: single form, budget and 3-day preview

The holiday Trip Planner at `/trip-planner` is one form. Pressing **Generate my trip** saves the trip on the
server and opens it at `/trip-planner/t/<token>` (a long random token; no trip details are put in the
address). Visa, family and business plans keep the earlier step-by-step planner (`/trip-planner?for=visa` and so on).

## How a trip is made

1. **Form** (`src/lib/planner/trip/form.ts`): origin, destination (a country alone is fine), arrival and
   departure dates or arrival + days, party with child ages, budget and currency, and optional preferences.
   Days count the arrival and departure days; nights = days − 1.
2. **Itinerary** (`prompts.ts` → `ITINERARY_SYSTEM`, checked by `readItinerary` in `plan.ts`): a short route
   request, then the days written two at a time in parallel. Every item has a start time, duration,
   description, reason, travel from the previous stop and a cost key. Every full sightseeing day must have
   at least three activities (normally four; two on a relaxed trip): a lighter answer is asked for again
   once. Arrival, departure and move days explain a lighter day in `pacingNote`.
3. **Prices** (`prompts.ts` → `PRICES_SYSTEM`, checked by `readPrices`): web research with sources, at most
   six items per lookup and eight lookups at once. A price, and an activity's official, tickets and opening
   hours pages, are kept only when the searches returned that page; anything else is "unavailable".
   Routine costs (breakfast, lunch, dinner, coffee, snacks and water, local transport) then fall back in
   this order: a second search for local cost data (`ALLOWANCE_SYSTEM`) → the same item's sourced price in
   another base of the trip. Both are labelled "Estimated allowance" with what they rest on and their
   source. Anything still missing can take the traveller's own allowance (Budget tab), labelled as theirs.
4. **Budget** (`calc.ts`): all arithmetic is in code: room rate × rooms × nights, tickets × adults and
   eligible children (free ages, family passes), meals × travellers per day (arrival/departure times and
   included breakfast respected), bookings counted once, sourced exchange rates, adjustable contingency.
   Day costs, one-time costs and categories come from the same lines, so they always add up to the total.
   Over budget, `budgetAdvice` shows the main cost drivers and savings worked out from sourced prices
   (a budget room price looked up for each base, free alternatives already in the plan, the low end of the
   meal and fare ranges, one night fewer). It never changes the trip.
5. **Access** (`gate.ts`, `store.ts`): unpaid visitors get the total, categories, route and days 1–3 (all
   days for trips of 3 days or fewer). Later days are never sent to the browser: their costs appear as one
   summary line per category ("Meals, coffee and snacks for days 4–20: estimated A$…"). Paid trips belong to the
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

- AI cost: a 20-day trip makes about 10 day requests and 15–25 price lookups. Check real costs in
  Admin → AI plan requests and set the daily AI limit to suit.

## Tests

- `npm run test:trip`: dates, form, price checks, budget arithmetic, changes and preview rules (no database).
- `TEST_DATABASE_URL=… node --import tsx --test --test-concurrency=1 tests/community/trip-builder.test.ts`:
  generation, failures and retries, the free allowance, gating, checkout and returning purchasers, and a
  20-day, two-base trip (meal allowances, activities per day, links, reconciling totals, locked-day
  summaries, over-budget advice, PDF links, the traveller's own allowance).
