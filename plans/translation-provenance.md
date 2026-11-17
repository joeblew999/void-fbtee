# plans/translation-provenance.md: every translation says who made it

## Why

On 2026-11-17 nothing could say who made most of the translations already in use: an AI (which
model), Claude, or a person. A later review couldn't tell old from new, or a model that was
replaced from the one in use. Found, all read-only, through the Cloudflare connector:

- **The live event translations** (D1 `void-fbtee-example-db`, `event_texts`, 10 rows):
  - 8 came from `db/migrations/20261111064630_sample_events.sql`, which says Claude wrote them.
    Each live row matches it exactly: id, title, description and the migration's own timestamp.
  - 2 (event `a7befff0…`, the dessert workshop, its en-US and ar-EG) were made by the post queue on
    2026-11-11 by a model nobody can name. AI Gateway has no logs from 2026-11-10 to 2026-11-13,
    and git history starts on 2026-11-16, so the code that made them is gone too.
- **The app's catalogs** (`apps/example/i18n/translations/`): 697 of 722 finished entries said
  nothing about who made them (ar-EG 350, th-TH 347).
- **Markdown page translations** said nothing either: only `translatedFrom`.
- **AI Gateway's logs** (gateway `default`, 11,940 requests since 2026-09-25) are shared by every
  app on the account, from dev and live, with no way to tell them apart (`metadata` empty).

## The rule

Nothing is stored without saying who made it. It's enforced, not hoped for:

- **The database:** `event_texts.translated_by` is `NOT NULL DEFAULT 'unknown'`, with
  `translated_at` and `gateway_log_id`. The default is there for code that doesn't say: an older
  deploy after a rollback (a rollback doesn't undo migrations). Then the row says `unknown` and is
  replaced, not left empty. It can't help a Worker Preview of newer code before its migration (that
  code reads columns the database doesn't have yet), hence the deploy-first rule below.
- **The catalogs and pages:** `vp build` fails on a finished entry or a translated page without
  `translatedBy` (check.ts).
- **Every AI request** is tagged in the gateway (`metadata`: `app`, `build`: dev or build, `kind`:
  fbt, post or page). Its log id (the `cf-aig-log-id` header) is stored with what its answer
  became (`gateway_log_id` in the database; `gatewayLogId` in entries and pages), so the exact
  request, answer and cost can be opened again.

## There are several databases

Each developer's local database, the live D1, and a Worker Preview's (which uses the live D1
without migrating). So the backfill is a migration in git, written as rules, not edits to one
database. Nobody edits live data by hand.

- `db/migrations/20261117103319_dark_roulette.sql` adds the columns, then marks a row `claude` only
  where its id, title and description are still exactly what the sample-events migration wrote.
  Every other row keeps the default, `unknown`. Proven on the live data before it ran: the same
  conditions, run as a read-only SELECT on the live D1, matched exactly the 8 seeded rows.
- The app replaces its own `unknown` rows: `untranslated()` counts one as missing, the daily job
  (`crons/reminders.ts`) queues its event, and `storeTranslations()` overwrites a row only when it
  says `unknown`. That's the same code in every database.
- Order: a deploy migrates, and a Worker Preview doesn't. Code that needs a new column is deployed
  before it's previewed (the README says so).

## The catalogs' history

Each unattributed catalog line (690 distinct lines) was matched against the answers in AI Gateway's
logs: a SHA-256 fingerprint of each line, compared inside the Cloudflare connector, so no text left
it. 2,600 of Gemma 4's 3,224 logged answers were searched (2026-11-17). Only 18 lines matched, and
every match fell in a short burst on 2026-11-15 (12:22, 13:47, 13:54, 15:18 UTC): the measure
script's runs over the same sample of strings, which the catalog already had and which it asks
again to compare. A model's answer equal to a catalog line shows the model wrote the same text, not
that it wrote the catalog's line. So nothing was attributed from the logs, and the search stopped
there: the rest of the logs (Inkling, Llama, the rest of Gemma, all from the same days) can't
settle it either.

So every one of the 697 entries, and both translated markdown pages (`pages/ar-EG/docs/tour.md`,
`pages/th-TH/docs/tour.md`), says `"translatedBy": "unknown"`. Claude reviews the entries like an
AI's translation (`awaitsReview`).

## Still to do

- Claude's review of the 697 `unknown` entries: `vp dev` asks for it (`reviewApp`); in a cloud
  session without a signed-in `claude`, Claude reviews them in the session by the SKILL's
  "Reviewing".
- Deleting a post (`pages/[lang]/events/[id].server.ts`, `remove`) deletes its translations,
  bookings and tickets in one batch, but its text stays in AI Gateway's logs (every request is
  logged whole, kept until the gateway's 10,000,000-log cap). The rows' `gateway_log_id`s name
  exactly which logs: delete those too when the post is deleted (AI Gateway's logs API, or the
  gateway's logging turned off for posts).
- A language taken out of the app leaves its rows in `event_texts`: `check()` reports a removed
  language's catalog files, not its database rows.
- Markdown pages aren't reviewed at all: `reviewTask` and `awaitsReview` cover catalog entries only.
  An `unknown` or an AI-made page needs the same review.

## Not doing

- Guessing a model from dates or deploy history: the deploys before 2026-11-16 aren't in git, and
  a guess would be worse than `unknown`.
- Retranslating the catalogs wholesale: Claude's review keeps what's right and redoes only what's
  wrong.
