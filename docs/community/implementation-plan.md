# Community implementation plan and status

Branch: `community-release`. Status on 8 October 2026: **all current-release scope built and
tested locally; waiting for owner review, integrations and a preview deployment.**

## What was found in the repository

- Next.js 16.3.6 (App Router; `proxy` instead of `middleware`; `params` are Promises), React 19.2,
  Payload CMS 3.90.2 with the Postgres adapter, Neon database, Vercel Hobby, Tailwind v4 design
  tokens. `AGENTS.md` requires reading the bundled Next docs before coding; this was followed.
- An editorial site already exists: destinations, stories (CMS articles), authors, topics, a
  staff-only CMS with roles (administrator, editor, contributor) and access tests.
- `/community` and its sub-pages were "coming soon" placeholders. There was no member account
  system, no email, no file storage and no scheduled jobs.

## Main decisions

| Decision | Reason |
|---|---|
| Keep everything in the existing Next.js + Payload app and database | One codebase, one deployment, reuse of the CMS admin for staff |
| A separate `members` collection, not member rows in `staff` | Staff rights and member rights can never mix; the session records which collection it belongs to |
| All member writes through a service layer; Payload write access is `nobody` | One place to check sessions, suspension, ownership, limits and audit; crafted API requests change nothing |
| One `contributions` table for questions, trip reports and activities | Shared moderation, search, revisions, bookmarks and reports |
| Moderation before publication for everything | Brief requirement and spam protection at launch |
| Edits to published posts become pending revisions | The approved version stays public until approval |
| Postgres full-text search (generated column) over approved text only | No extra service; pending text can never be found |
| Durable email queue, sent straight away and retried by the daily job | Works on Vercel Hobby; no lost or duplicate email |
| Integer money per currency, no conversion | Honest totals without exchange-rate data |
| UTC instant + IANA zone + local time for events | Correct across time zones and daylight saving |
| GeoNames, countries-list and tz-lookup data for destinations | Open licences (CC BY 4.0, MIT, CC0), worldwide coverage; credited on `/community` |
| Indexing separate from approval, conservative defaults | Avoids thin or low-quality pages in Google |
| Community switched off by default (`publicAccess`, `signupsOpen` false) | Nothing goes public by deploying |

## Checklist

### Stage 1: foundations
- [x] Schema, access rules, migration (tested up/down/up)
- [x] Community settings switches
- [x] Destination taxonomy and import script (252 countries, 5,485 cities)
- [x] Rate limits, audit log, metrics, settings

### Stage 2: accounts, questions, moderation
- [x] Sign-up with confirmed email, sign-in, sign-out, password reset, session expiry handling
- [x] Public profiles `/travellers/<handle>`
- [x] Questions: ask, similar questions, answers, one level of replies, accept answer, resolved
- [x] Moderation console: queue, review with change comparison, replies, reports, members,
      suspensions, trust, suggestions, audit log, test inbox, dashboard

### Stage 3: trip reports
- [x] Structured form: costs (per person or party, many currencies), itinerary days and stops
- [x] Photos: resized in the browser, checked and re-encoded on the server, metadata removed
- [x] Copy an itinerary into a private plan

### Stage 4: activities
- [x] Activities with time zones, all-day events, capacity, price, disclosure, private organiser contact
- [x] RSVP (going or interested, optional public name), calendar file, cancel and postpone, reschedule through review
- [x] Notifications to people who responded

### Stage 5: discovery and personal tools
- [x] Search with filters and crawlable pagination
- [x] Community home, destination hubs, topics
- [x] Bookmarks, follows, private trip planner
- [x] Notifications page, email preferences, unsubscribe, weekly digest, data export, account deletion

### Stage 6: SEO, operations, release
- [x] Canonicals, redirects for wrong slugs, noindex rules, sitemap, robots, JSON-LD (QAPage,
      DiscussionForumPosting, Event, BreadcrumbList, ProfilePage)
- [x] Daily job route and Vercel cron
- [x] Owner dashboard with real counts only
- [x] Tests: 82 acceptance tests, browser checks, migration rehearsal
- [x] Independent security review; all findings fixed
- [x] Documents in `docs/community/`
- [ ] Owner: Resend account and domain, R2 bucket, `CRON_SECRET`
- [ ] Owner: Neon preview branch and Vercel Preview variables; review the preview
- [ ] Owner and lawyer: guidelines, terms and privacy text for member content
- [ ] Owner: approve launch, run the production checklist

## Known gaps in this release

- No in-app appeal; members use the contact page (still a placeholder).
- Handles cannot be changed; no home country or website on profiles.
- No "hybrid" activity format. Organisers postpone or cancel directly; a new date goes through review.
- No save button on editorial guide pages yet (the bookmark system supports it).
- The search sort is fixed: by relevance when words are typed, otherwise newest first.
- Times show in the event's own zone only, without conversion to the reader's zone.
- Destination and topic pages of the editorial site are still sample content and are left out of
  the sitemap.
