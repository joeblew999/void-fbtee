# plans/README.md: the plans, in the order they're done

Each plan is done, checked and committed before the next one starts. A plan's own file says
what it changes; this list is the only place that says when.

1. `translation-provenance.md`: every translation says who made it (database, catalogs, pages,
   AI Gateway's logs), enforced, with the past filled in from evidence.
2. `translated-content.md`: translating what people post comes from the package; the app only
   says what to translate.
3. `translation-rework.md`: one translator (Gemini 3.5 Flash on Cloudflare) for dev and runtime,
   checked the same way in dev and build, reviewed by Claude at dev time.
4. `primitives.md`: void-fbtee's missing primitives, moved out of the example into the package.
5. `use-cases.md`: one event, many people, as data, built on the primitives.
6. `video-conferencing.md`: `void-moq`, built on all of the above.

Before it, built and committed locally, newest first: `no-casts.md` (no casts or `any` in the
package, but two explained ones); `like-better-auth.md` (the translations table kept by the
package, as Void keeps Better Auth's; then the user files `void-package-schema-issue.md`);
`types-from-schema.md`.

Now: `layout.md`: the package's `src/` laid out as a Void app's folders, and every query in one file each
(the app's `src/events/store.ts`, the package's `src/db/translations.ts`), one database session per handler.

Before it: `reliable-work.md`: work done in order and nothing lost: the database records what's owed,
one step starts the next, decisions read the main database, a sweep after crashes.

Waiting on others, not in the order:

- `void-upgrade.md`: Void 1.8.0 to 1.10.0 and Vite+ 1.6.0 to 1.7.0, together. Waits for a Void
  release whose `void init` writes a Vite+ range that 1.7.0 can use (reported 2026-11-18); then
  the fresh test's pins and README "Reported to Void" go.
- `fbtee-issues.md`: two issues for fbtee (locale matching on a server, and two things in Arabic),
  drafted, filed only with the user's OK.
- `void-package-schema-issue.md`: asks Void whether a package can bring tables into an app the way
  Better Auth's are (drafted 2026-11-19; filed by the user from the Mac, as this session can't).
- `void-form-without-javascript.md`: waits on Void (an issue drafted for voidzero-dev/void, filed
  only with the user's OK).
- `many-languages.md`: what grows (Worker size, catalogs per request, hreflang, sitemap) when an
  app has every language. To measure first.
- `quiet-harbor-atlas.md`: the long plan, steps 1–8 done. Steps 9 (sign-in) and 10 (API routes with
  a language) wait until the example needs them, and "Still open" has the preview-AI note, the
  user's call.

A plan that's finished is deleted; git keeps it.
