# Owner launch guide

This is the practical side: what the software cannot do for you. A community grows from real
people posting useful things. No feature or number in this release replaces that.

## Before opening

1. Finish the steps in `setup-and-deployment.md` (email, photo storage, daily job, migration,
   destinations).
2. Read and edit `/community/guidelines` and ask a lawyer to review it together with the terms and
   privacy pages, so they cover member content, photos, takedowns and account deletion.
3. Decide who moderates and tick *Community moderator* for them.
4. Keep the community closed (the default) while you test on the preview.

## The first contributors (weeks 1–4)

- Personally invite 10–20 people you know who have travelled recently: friends, customers, fellow
  travellers. Ask each one for one specific thing, such as a trip report on a place they know well,
  or the answer to one real question.
- Seed real questions you or your team actually have. Do not post fake questions or answers under
  invented names. The posts are labelled as member content, and invented activity damages trust
  with readers and with Google.
- Reply to every first post within a day, publicly and kindly.
- Do not send invitations or marketing email from the site; it only sends account and
  notification email.

## Which destinations to promote

- Start narrow: the 5–10 places your editorial guides already cover well. Link from each
  editorial guide to its community hub, and from the hub back to the guide (this already happens
  automatically where both exist).
- Tick *Hub indexable* only for hubs that have several genuinely useful posts. A thin hub page
  that ranks hurts more than it helps.
- All 4,519 cities exist for posting, but only places with content appear in the directory.

## Content quality

- Approve first-hand, specific posts: dates, prices paid, what went wrong, what they would change.
- Request changes rather than reject when a post is close.
- Allow indexing of trip reports and activities one by one, only when they are something a
  traveller would be glad to find from Google.
- Commercial posts (tour operators, hotels) must declare their interest. The form asks for this,
  and links are marked `sponsored`/`ugc`. Consider paid listings later, separately, and clearly
  labelled.

## Weekly workload (estimate for the first months)

- Moderation: 15–30 minutes a day at low volume.
- One hour a week: read the dashboard, answer open questions, approve indexing for the best posts,
  write one editorial piece that links to community content.
- Monthly: review suggestions, check Search Console for community pages, adjust settings.

## What to watch (the `/moderation` dashboard)

- Oldest item waiting: keep it under a day.
- Questions without an approved answer: these are your best prompts for experienced members.
- Active contributors (30 days) and accepted answers: the real health signals.
- Email: failed messages and the mode (must say "resend" in production).
- Scheduled jobs: last run time. A missing run means `CRON_SECRET` or Vercel cron needs checking.
- For traffic, clicks and indexing use Google Search Console and your analytics. The dashboard
  deliberately does not estimate them.

## Plan limits to know about

- Vercel Hobby allows the daily job to run only once a day. Vercel's terms also limit Hobby to
  non-commercial use, so once Travel Notes earns money (ads, affiliates, listings) the site needs
  the Pro plan.
- Resend's free tier has a daily sending limit. Check the current numbers on their pricing page
  before launch.
- Neon free tier storage and compute limits apply to the database.
