# Test results

Recorded on 8 October 2026 on branch `community-release`, in a Linux workspace with a local
PostgreSQL 16 database. All data was synthetic: `example.test` addresses and "[Demo]" content.
No email was sent: the capture transport kept every message in the database.

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | 0 errors |
| `npx eslint src tests` | 0 problems |
| `npm run build` (Next.js 16.3.6 production build) | Success; all community routes built |
| `TEST_DATABASE_URL=… npm run test:community` | **82 tests, 82 passed, 0 failed** |
| `TEST_DATABASE_URL=… npm run test:access` (existing editorial access tests) | **21 passed, 0 failed** |
| Migration on a disposable database: `payload migrate` → `migrate:down` → `migrate` | Up, down and up all succeeded; the tables were present, removed, then present again |
| `node tests/e2e/community-flow.cjs` (real browser, production build) | **36 of 36 checks passed** |
| `node tests/e2e/photo-upload.cjs` | Passed: a 3000×2000 JPEG with GPS data was resized on the device, stored as 2400×1600 WebP with no EXIF, pending review |
| `node tests/e2e/admin-panel.cjs` | CMS login works; dashboard shows the moderation link; community collections open for an administrator; private plans are not listed |
| `curl` on REST endpoints as a visitor | `/api/contributions`, `/api/replies`, `/api/plans`, `/api/globals/community-settings` → 403; `/api/members` → 501 |

## The brief's 18 acceptance outcomes

| # | Outcome | Evidence |
|---|---|---|
| 1 | Visitors see approved content only, not drafts, notes or plans, through UI, APIs, search, media or metadata | core tests §1; security tests "raw REST API reads"; e2e "pending question is not public (404)", "activity page never shows the private contact"; REST curl checks |
| 2 | Unverified or suspended users cannot act, even with crafted requests | core tests §2 (5 tests) |
| 3 | Question → approval → answer → accepted | core tests §3 (6 tests); e2e sign-up → question → moderator approval → public page |
| 4 | Edits stay pending while the approved version stays public; rejected content never leaks | core tests §4 (6 tests) |
| 5 | Ownership checks on posts, notifications, uploads, plans | core tests §5 (3 tests) |
| 6 | Repeated requests make no duplicates | core tests §6 (4 tests) |
| 7 | Costs: per person or party, several currencies, no conversion | features §7 (4 tests); e2e "trip report shows its costs" |
| 8 | Itinerary copy into a private plan with credit; original unchanged | features §8 (2 tests) |
| 9 | Time zones, all-day events, daylight saving, cancel and reschedule with notifications | features §9 (8 tests, including capacity); e2e calendar file and RSVP |
| 10 | Hostile HTML, URLs and uploads neutralised; no server-side fetching of member links | features §10 (7 tests); photo-upload e2e |
| 11 | Removal takes an item out of search, lists, sitemap and its page | features §11/13 "removing a post…" and "a bookmark or plan link…" |
| 12 | Search and pagination stable with realistic volume | features §12 (4 tests, 130+ generated posts) |
| 13 | Canonical, redirects, noindex, sitemap and structured data follow the policy | features §11/13; e2e "unanswered question is noindex", JSON-LD present; wrong slug → 308 to canonical |
| 14 | Opt-out, deduplicated retries, visible failures, no accidental real email | features §14 (7 tests) |
| 15 | Export and deletion follow the policy | features §15 (3 tests); security test "account deletion removes private contact details" |
| 16 | Keyboard, mobile, validation failures, expired session | e2e: keyboard-only sign-in; no sideways scroll at 390px on 8 pages; trip form validation shown next to the field; expired session keeps the text and says to sign in again |
| 17 | Existing pages and login keep working | `test:access` 21/21; `/`, `/destinations`, `/destinations/japan/kyoto`, `/stories/…`, `/topics/tips`, `/about`, `/admin/login` return 200; CMS login and collections open |
| 18 | Migrations on a disposable database; rollback documented | up → down → up rehearsal above; rollback in setup-and-deployment.md |

## Independent security review

A separate reviewer, who had not seen the code being written, reviewed the release. Findings and
what was done:

| Severity | Finding | Fix | Test |
|---|---|---|---|
| High | Open redirect via `?next=/%09/evil.com` | `safeReturnPath` now rejects control characters and backslashes and compares origins | security test (11 bad inputs) |
| Medium | REST API returned replies under hidden posts | REST reads of community collections are closed to non-moderators | security test; curl 403 |
| Medium | REST exposed author ids of deleted members and moderator notes | same fix | same |
| Medium | Attackers could lock an account and detect which emails exist | CMS lock turned off; limits per account and address plus a looser per-account limit; same message for every failure | security test (12 wrong attempts from different addresses, owner still signs in) |
| Medium | Deletion kept organiser contacts, edit history and votes | all erased; removed posts keep no text; export now includes edit history | security test |
| Low | Test inbox showed working reset links to all moderators | administrators only; capture refused on any production server unless explicitly allowed | — |
| Low | "Similar questions" ignored the closed switch and had no limit | members only and rate-limited; search page rate-limited | — |
| Low | Moderators could read private plans, bookmarks, follows, notifications | no one can read them through the API or admin | admin-panel e2e (plans not listed) |
| Low | Export link could be triggered from another site | refused unless opened from this site | — |
| Low | Animated images could use a lot of memory | refused | — |
| Low | Community settings readable by anyone | staff only | curl 403 |

Also found and fixed during browser testing:
- RSVP capacity was only enforced in the page; the service now refuses "going" when full (test added).
- The local photo folder was not created on first upload.
- The private organiser contact was kept in the browser's draft backup.
- Footer still linked to the old "Discussion groups" placeholder.

## Not tested, and why

- **Real email through Resend**: needs the owner's Resend account and verified domain. The Resend
  transport is written to the documented API but has not sent a real message.
- **Cloudflare R2 storage**: needs the owner's bucket. The storage plugin is the official Payload
  S3 adapter; uploads were tested on local disk only.
- **Vercel cron**: the route and its secret check were exercised locally (503 without a secret);
  the Vercel schedule itself runs only after deployment.
- **Preview deployment on Vercel**: needs a Neon preview branch and Preview variables (owner steps
  in setup-and-deployment.md).
- **Screen readers**: structure, labels and live regions were built for them, but no test with
  NVDA or VoiceOver was done.
- **Load testing**: not done. Search was checked with about 130 posts.
- **Backup restore**: documented with Neon branches; not exercised on the real Neon project.
