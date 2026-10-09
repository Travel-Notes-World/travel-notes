# Setup and deployment

Nothing in this release is live until the owner merges the pull request and switches the
community on. The steps below are in the order they should be done.

## 1. Environment variables

Set these in Vercel → Project → Settings → Environment Variables. Never paste secrets into chat,
code or documents.

| Variable | Required? | Where | What it does |
|---|---|---|---|
| `DATABASE_URL` | Required (exists) | all | Neon Postgres. Preview must use its own Neon branch, never production. |
| `PAYLOAD_SECRET` | Required (exists) | all | Signs sessions and unsubscribe links. |
| `NEXT_PUBLIC_SITE_URL` | Required (exists) | all | Absolute links in emails and sitemaps. |
| `NEXT_PUBLIC_INDEXABLE` | Required for launch | production | `true` only when the owner approves launch. Otherwise robots.txt blocks all and the sitemap is empty. Leave unset on Preview. |
| `EMAIL_TRANSPORT` | Required | all | `resend` (production), `capture` (Preview testing: nothing is sent) or `off`. |
| `RESEND_API_KEY` | Required for real email | production | From Resend → API Keys. |
| `EMAIL_FROM` | Required for real email | production | For example `Travel Notes <community@your-domain>`; the domain must be verified in Resend. |
| `EMAIL_REPLY_TO` | Optional | production | Where replies to community email go. |
| `CONTACT_INBOX` | Required to receive contact-form email | production | The address that receives messages from `/contact` (for example `hello@your-domain`). It must be able to *receive* email: Resend only sends. Without it, messages are still saved in the CMS (Inbox → Contact messages) and the daily job emails them once it is set. |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Required for photos on Vercel | all that allow uploads | Cloudflare R2 (or other S3-compatible) bucket. Without them photo upload says it is unavailable; everything else works. |
| `S3_REGION` | Optional | | Defaults to `auto` (correct for R2). |
| `PREVIEW_DATABASE_IS_SEPARATE` | Preview only | preview | `yes` lets preview builds run database migrations. Set it only when Preview's `DATABASE_URL` is its own Neon branch (`preview`), never production. Without it, preview builds skip migrations. |
| `CRON_SECRET` | Required | production | At least 16 random characters. Vercel sends it to `/cron/daily` automatically. Without it the daily job refuses to run and the dashboard says so. |
| `ALLOW_EMAIL_CAPTURE` | Never on the live site | test servers only | Lets a production build on a test machine use `capture`. |
| `COMMUNITY_RATE_LIMIT_MULTIPLIER` | Never in production | tests/local | Raises rate limits for automated tests; ignored in production. |
| `TEST_DATABASE_URL` | Tests only | your computer | A throwaway database for `npm run test:community` and `test:access`. |

Missing integrations never fake success:
- no email → sign-up is closed and says why;
- no bucket → photo upload says it is unavailable;
- no `CRON_SECRET` → `/cron/daily` answers 503 and the dashboard warns.

## 2. Database migration

The release adds one migration, `src/migrations/<timestamp>_community.ts`. It was tested up → down → up on a
disposable database.

1. **Back up first.** In Neon, create a branch from production named `backup-before-community`
   (this is an instant copy). Note the time.
2. Run the migration against the target database from your computer:
   `DATABASE_URL=<target> npx payload migrate`
3. Import destinations (idempotent; never overwrites existing records):
   `DATABASE_URL=<target> npm run destinations:import` (all 252 countries and 4,519 cities) or
   `-- --min=1000000` for a smaller set first.
4. Never run `npm run community:demo-seed` against production. It refuses anything except a
   database on localhost and needs `ALLOW_DEMO_SEED=yes`.

## 3. Preview deployment (for review)

1. In Neon the branch `preview` (a copy of production, created 9 Oct 2026) is Preview's database.
   Its `neondb_owner` password differs from production's. To refresh it with current production data,
   use *Reset from parent* in Neon.
2. In Vercel, set **Preview**-scoped variables:
   - `DATABASE_URL` = the `preview` branch (pooled connection string);
   - `PREVIEW_DATABASE_IS_SEPARATE=yes`, so preview builds apply migrations to that branch;
   - `EMAIL_TRANSPORT=capture`;
   - optionally the `S3_*` variables for a test bucket.
   - Leave `NEXT_PUBLIC_INDEXABLE` unset.
3. Migrations run automatically on each preview build. Run step 2.3 against the preview branch if you want destinations there.
4. Push the branch. Vercel builds a preview URL automatically.
5. Sign in to `/admin` as administrator → Community settings: tick *Community open to the public* and
   *Sign-ups open*. Tick *Community moderator* on any staff who will moderate.
6. Test: sign up with any address. The confirmation email appears in `/moderation/inbox`
   (administrators only); open its link. Post, approve in `/moderation`, check public pages.

## 4. Production release checklist

1. Owner has reviewed the preview and approved launch.
2. Resend domain verified; `RESEND_API_KEY`, `EMAIL_FROM` set for Production.
3. R2 bucket created; `S3_*` set for Production.
4. `CRON_SECRET` set for Production.
5. Neon backup branch created (step 2.1).
6. Run the migration and destination import against production (steps 2.2 and 2.3).
7. Merge the pull request. Vercel deploys production.
8. In `/admin` → Community settings, the community is still closed (default). Check `/moderation`
   loads, the dashboard shows email mode "resend" and no warnings.
9. Send one real test: sign up with the owner's own address, confirm, post, approve.
10. Open the community: tick *Community open to the public*, then *Sign-ups open*.
11. Only when ready for Google: set `NEXT_PUBLIC_INDEXABLE=true` and redeploy. Submit
    `/sitemap.xml` in Search Console.

## 5. Scheduled job

`vercel.json` runs `/cron/daily` once a day at 18:17 UTC (Hobby plan allows once a day and may fire
any time in that hour). It retries email that failed, marks past activities as ended, deletes
unused uploads after two days, clears old rate-limit windows and queues weekly digests. Each job
uses a database lock and is safe if Vercel calls it twice.

Emails are sent straight away when they are created. The daily job only retries failures, so on
Hobby a failed email can wait up to a day. On Vercel Pro you can run `/cron/outbox` every 10 minutes.

To run a job by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/cron/daily`.

## 6. Rollback

- **Code:** in Vercel → Deployments, "Promote" the previous production deployment (instant).
  The new tables are ignored by the old code, so this is safe on its own.
- **Switch off without redeploying:** untick *Community open to the public* (pages show "not open
  yet") or *Submissions open*.
- **Database (only if the migration itself caused a problem):**
  `DATABASE_URL=<target> npx payload migrate:down` removes the community tables (all community
  data is lost). Or restore the Neon backup branch from step 2.1.
- Rehearsed: migrate up, down and up again on a disposable database (see test-results.md).

## 7. Running locally

```
npm install
# .env.local with DATABASE_URL (local Postgres), PAYLOAD_SECRET, EMAIL_TRANSPORT=capture
npx payload migrate
npm run destinations:import -- --min=1000000
ALLOW_DEMO_SEED=yes npm run community:demo-seed   # "[Demo]" content, localhost only
npm run dev
```

Using a personal Neon branch instead of local Postgres also works (`.env` or `.env.local`, with
`DATABASE_URL` pointing at your own branch, never production). Notes for that setup:

- Run `npx payload migrate` **before** opening `/admin` or `/community`. Until then the code asks for
  columns that do not exist yet (for example `column staff.community_moderator does not exist`).
- `npx payload migrate:status` shows what has run without changing anything.
- The demo seed refuses any database that is not on localhost, so create test content by hand.
- A branch copied from production also copies its staff accounts, so `/admin` shows a login form,
  not "Create first user". Ask the owner for an account rather than resetting a copied one.
- `/moderation` answers 404 unless you are signed in as staff (by design).
- Browser extensions (Grammarly, ColorZilla and similar) add attributes to `<html>` and `<body>` and
  cause hydration warnings in development. Test in a private window to see only real problems.

Tests: `TEST_DATABASE_URL=postgresql://…/tn_test npm run test:community` (82 tests) and
`npm run test:access` (21 tests).

## 8. Staff two-step login (2FA)

Every staff account must use an authenticator app (Google Authenticator, Microsoft Authenticator,
1Password, Bitwarden and similar) in addition to its password.

- **First sign-in after this was switched on:** after the password, the CMS shows a QR code. Scan it
  with the app (or use "Add code manually"), then type the 6-digit code. Done once per account.
- **Every later sign-in:** password, then the current 6-digit code from the app.
- **Until the code is entered** the account has no staff rights anywhere (CMS, API, moderation
  console). The rule is in `src/access/twoFactor.ts`; it is enforced in `hasRole`,
  `userCanModerate` and the site session, so visitors and community members are not affected.
- **Wrong codes** count towards the same lockout as wrong passwords (5 tries, 15 minutes).
- **Lost phone:** after confirming by phone that the request is genuine, an administrator runs
  `DATABASE_URL=… PAYLOAD_SECRET=… npm run staff:reset-2fa -- person@example.com`. The person sets
  up the app again at their next sign-in.
- **Tests** switch it off with `STAFF_2FA=off`, which a production build ignores.
  `tests/community/two-factor.test.ts` runs with it on.
