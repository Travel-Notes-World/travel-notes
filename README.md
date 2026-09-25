# Travel Notes

Editorial travel publication: destination guides, itineraries, practical tips, photography, video and gear reviews.

**Status: foundation scaffold.** Home, Destinations and Article templates run on clearly labelled sample content (`src/content/sample.ts`). No CMS, database, ads, newsletter or analytics are wired yet — that follows the phased roadmap in the Developer Implementation Plan (25 Sep 2026).

- Design system (tokens, components, page templates): https://claude.ai/artifact/L3JWve3Gp6mdFJP2Ckb6Rr
- Tokens are mirrored in `src/app/globals.css` and exposed to Tailwind via `@theme`.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Stack (pinned by the scaffold)

Next.js App Router, TypeScript, Tailwind CSS v4, `next/font` (Fraunces + Inter). Payload CMS on Neon PostgreSQL, Cloudflare R2 media and the job worker are added in Phase 1.

## Environment

See `.env.example`. `NEXT_PUBLIC_INDEXABLE` stays `false` until launch acceptance passes.
