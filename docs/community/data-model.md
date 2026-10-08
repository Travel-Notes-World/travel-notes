# Community data model

This describes the community tables added in migration `src/migrations/*_community.ts`, who owns
each record, how states change, and who can read or change what. The code is the final authority:
collections are in `src/collections/community/`, rules in `src/access/community.ts`, and every
write in `src/lib/community/*.ts`.

## The main rule: one door for writes

- Members never write through Payload's REST API or admin panel. Every community collection has
  `create`, `update` and `delete` set to `nobody`.
- Every change goes through a service function in `src/lib/community/`. It checks the session,
  re-reads the member from the database (`requireActive`: verified, not suspended, not deleted),
  checks ownership, validates the input, writes inside one database transaction, and writes an
  audit record where the brief asks for one.
- Server actions (`src/lib/community/actions/*`) are thin: they read the session and call a service.
- The raw REST API returns nothing from community collections to visitors or members. Moderators
  can read through the admin panel. The site's own pages read approved rows through the Local API.
- `members` has `endpoints: false`: no REST login, sign-up or password routes. Sign-in goes through
  the site's own forms (`members.ts`), which add rate limits and plain-language errors.

## Entities

| Collection | What it holds | Owner | Public? |
|---|---|---|---|
| `members` | Community accounts: email (private), handle, display name, bio, experience, email preferences, status (`active`, `suspended`, `deleted`), trust flag, counts | the member | Only through `/travellers/<handle>` (handle, name, bio, counts, approved posts). Never email. |
| `contributions` | Questions, trip reports and activities in one table with `type`. Groups: `question`, `trip` (with `tripCosts` and `itineraryDays` → stops arrays), `activity`. Moderation group, indexing group, `searchText`, `destinationTree`, counts | author (member) | Only when `state = published`, and only the fields the public page shows |
| `revisions` | A snapshot of each submission and each edit, with review state and reason | author | No |
| `replies` | Answers and comments, one level of nesting | author | Only when published and the parent post is published |
| `media` | Member photos, re-encoded to WebP (no EXIF/GPS), `state` pending → approved / rejected / withheld / removed | uploader | Only approved photos on published posts |
| `votes` | "Helpful" marks. Unique `key` = member + target | member | Counts only |
| `bookmarks` | Saved posts and guides. Unique key | member | No |
| `follows` | Followed destinations. Unique key | member | No |
| `rsvps` | Going / interested, optional public listing. Unique key | member | Names only if the member chose "show my name" |
| `plans` | Private saved-trip planner: days and items, optional source post | member | Never (no sharing in this release) |
| `reports` | Reports about posts, replies, members or photos | reporter | No |
| `moderation-actions` | The audit log: who did what, when, why | — | No |
| `destination-suggestions` | Places members ask to be added | member | No |
| `notifications` | In-app notices, unique `dedupeKey` | recipient | No |
| `email-outbox` | Durable email queue with idempotency key, attempts, status | — | No |
| `rate-limits`, `metric-counters`, `job-runs` | Operations data (hashed subjects, no personal data in counters) | — | No |
| global `community-settings` | Launch switches and review rules | owner | No (staff only) |

`destinations` (existing editorial collection) gained: kind `area`, `aliases`, `latitude`,
`longitude`, `timeZone`, `population`, `hubIndexable` (administrator only) and a `source` group
(GeoNames id and licence). `staff` gained `communityModerator`.

## Important indexes and constraints

- Unique `key` on votes, bookmarks, follows, RSVPs: repeating a request never creates duplicates
  (raw `INSERT … ON CONFLICT`).
- Unique `dedupeKey` on notifications and idempotency key on the email outbox.
- `contributions.search_vector`: a generated `tsvector` over title + `search_text` with a GIN index.
  `search_text` is filled only from approved content and emptied on removal, so search cannot show
  pending or removed text. Added by hand at the end of the migration.
- `destinations_name_lower_idx` for the destination finder.
- `(contribution, number)` unique on revisions.

## States

Contributions:

```
draft ──submit──▶ pending ──approve──▶ published ──hide──▶ hidden ──restore──▶ published
                    │  └─request changes─▶ changes_requested ──resubmit──▶ pending
                    └─reject─▶ rejected
published / hidden ──remove (moderator or author)──▶ removed
```

- Editing a published post creates a pending revision. The approved version stays public until a
  moderator approves the edit. A rejected edit never appears.
- Activities also have an event status worked out at read time: scheduled, postponed, cancelled,
  rescheduled (original date kept), ended (by the clock).

Replies: pending → published / rejected → hidden → removed. Trusted members' replies can skip
review only if the owner switches on `autoApproveTrustedReplies` (off by default).

Members: unverified → active ⇄ suspended (with end date and reason) → deleted.

## Money and time

- Costs are stored as whole minor units (cents, yen) with an ISO currency code. Nothing is
  converted; totals are shown per currency. Each cost line says per person or whole party, the
  basis (total, per day, per night) and actual or estimate.
- Activity times are stored three ways: UTC instant (for sorting and "upcoming"), IANA time zone,
  and the local text the organiser typed. A time that happens twice when clocks go back uses the
  first; a time that does not exist when clocks go forward moves forward.

## Account export and deletion policy

- **Export** (`/account/export`, 5 per day): the member's account details, posts, replies, edit
  history, plans, bookmarks, follows, RSVPs, votes, reports they sent, notifications, photos and
  suggestions. Not included: other people's content, moderators' notes, security records.
- **Deletion** (`/account/settings`, needs password and typing DELETE):
  - Email, password, handle, name, bio, avatar and email preferences are erased; the row stays as an
    anonymous "Deleted member" marker so audit records still point somewhere.
  - Plans, bookmarks, follows, RSVPs, votes, notifications, unsent email, drafts, pending and
    rejected posts and replies, unused photos and pending destination suggestions are deleted.
  - The organiser contact on every activity, and in its edit history, is erased.
  - Approved posts stay as "Deleted member" unless the member ticks "remove my posts too". Then
    they are removed and their text is blanked, and their edit history snapshots are emptied.
  - All sessions end.
- Audit records and reports are kept (needed to handle abuse and legal requests).

## Who can do what

| Action | Visitor | Member | Moderator | Administrator |
|---|---|---|---|---|
| Read approved posts | ✓ (when community open) | ✓ | ✓ | ✓ |
| Post, reply, vote, RSVP, bookmark, follow | | ✓ if verified and active | | |
| Edit or remove own post | | ✓ | | |
| Approve, reject, hide, remove, restrict accounts | | | ✓ | ✓ |
| Allow indexing of a trip/activity, hub indexing | | | | ✓ |
| Test inbox (captured email) | | | | ✓ (non-production only) |
| Change community settings | | | | ✓ |
