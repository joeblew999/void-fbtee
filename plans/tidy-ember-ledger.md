# plans/tidy-ember-ledger.md: the tests delete the events they post

## Context

The tests that run against the live site (`vp run test:deployed`, in CI after every push) post
real events through the site's form and never remove them. On 2026-11-13 the live database held
about 45 of them ("Test event 466d5300", two `</script>` injection tests, many "أمسية شعر"), each
dated 1 January 2026 so the board never lists them, but each with its own page and a place in
the sitemap. Every CI run adds more.

CI has no Cloudflare credentials, by design (`.github/workflows/ci.yml`: Workers Builds deploys,
CI only tests what it deployed), and none will be added. So the tests can only remove their
events through the site itself. The site has no way to delete an event, and posting has no
accounts.

## Decision: a private delete link for whoever posts an event

Common practice for posting without an account (classified-ads sites, pastebins): the poster gets
a secret link that deletes what they posted.

1. **The key.** Posting makes a random key (32 bytes from `crypto.getRandomValues`, base64url). The
   database keeps only its SHA-256 (`events.delete_key_hash`, a new nullable column, made with
   `void db generate`). The sample events have none, so nobody can delete them.
2. **Handing it over.** Posting redirects to the event's page with the key in the URL's fragment
   (`#key=…`, a `hash` in Void's redirect destination: `reference/api/types.md`). A fragment
   never reaches the server, so the cached event page stays the same for everyone, and it isn't
   sent on to other sites. Not a cookie: a request with a cookie skips Void's page cache
   (`guide/edge/revalidation.md`, "Cache bypass"). Not a query parameter: the cache ignores
   those, and its key would end up in logs.
3. **On the event page.** When the address has a key, the page shows the poster a short note:
   keep this link to delete the event, with the link to copy and a "Delete this event" button.
   Without a key, nothing changes.
4. **Deleting.** A named action (`?delete`, `pages/[lang]/events/[id].server.ts`) takes the key,
   compares its SHA-256 with the stored one, and deletes the event's bookings, translations and
   the event in one batch. Then it clears that event's page in every language, the board in every
   language and the sitemap, and goes to the board. A wrong key gets a 403; an unknown event a 404.
5. **The tests.** Each test that posts keeps the key from the address it lands on, and deletes
   its event when it ends (`postEvent` in `e2e/events.test.ts`, the injection test and the Arabic
   posting test). One new test: post, delete with a wrong key (refused), delete with the right key,
   and the event's page is then the not-found page.
6. **Translations.** The note, the button and its messages in every language (`vp run i18n:check`).
7. **Docs.** `DESIGN.md` (the note on the event page), the README's description of the demo, and
   `SKILL.md` only if the package changes (it shouldn't).

## Once, by hand: the junk already there

The events posted before this have no key, so the tests can't delete them. I delete them from the
live database once with `cf d1 query` (the keyring sign-in): every event whose description is
"Posted by the tests." or whose title is "أمسية شعر" or the `</script>` one, with their bookings
and translations, after listing them first. The same on the dev database. The sample events
(`db/migrations/20261111064630_sample_events.sql`) stay. Their cached pages clear on the next deploy.

## Not in this plan

- Editing an event with the same key.
- Removing events long past on a schedule.

## Verification

`vp check`; the events tests on dev only (`e2e/events.test.ts`, not the full suite); by hand on
dev: post, see the note, delete, the board and the sitemap no longer have it. After the push: CI's
`vp run test:deployed`, then a query of the live database showing no new test events.
