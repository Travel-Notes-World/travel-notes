# Future phases (not in this release)

These were deliberately left out, as the brief requires. Each needs the listed groundwork first.

| Feature | Why not now | Prerequisites |
|---|---|---|
| Real-time group chat and private direct messages | High abuse and safety risk; needs real-time infrastructure and round-the-clock moderation | Stable moderator team; blocking and muting; message reporting; a real-time service (for example Pusher or Ably); legal review of private-message handling |
| Traveller matching by dates or routes, nearby people | Location privacy and personal-safety risk | Proven moderation, identity signals beyond email, opt-in location with coarse precision, safety guidance |
| Payments, ticket sales, accommodation, bookings | Financial and consumer-law obligations | Business structure, payment provider (Stripe), refund and dispute policy, tax setup |
| Paid or featured listings for organisers | Needs clear labelling and a sales process | Listing terms, `sponsored` labelling (links are already ready for it), billing |
| AI itinerary generator or assistant | Accuracy and liability; must not publish automatically | Enough approved first-hand content to ground answers, citation display, human review of anything published |
| Automatic translation and multilingual publishing | Quality and duplicate-content risk | hreflang strategy, translation review workflow, language field on content (currently English only) |
| Mobile apps | The responsive site covers phones | Sustained mobile traffic; push-notification need |
| Gamification (badges, points, leaderboards) | Encourages low-quality posting early on | An active community; rules that reward accepted answers rather than volume |
| Public cost research dashboard | Not enough real data yet; misleading with few reports | Hundreds of approved trip reports per destination; methodology page; currency conversion with dated rates |
| Advanced trip planning (route optimisation, maps, sharing plans) | The simple private planner is the current scope | Map provider, plan sharing permissions, collaboration |
| In-app appeals | Low volume expected at first | A written appeals policy; a second moderator |
| Changeable handles, home country and website on profiles | Not in the data model yet | Migration; link-safety rules for a website field; redirects from old handles |
| More frequent background jobs | Vercel Hobby allows one cron run a day | Vercel Pro; then run `/cron/outbox` every 10 minutes |
| Hybrid (in person + online) activity format | Only in person and online exist | Add the option and the matching form fields |
