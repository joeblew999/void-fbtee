# plans/README.md: the plans, in the order they're done

Each plan is done, checked and committed before the next one starts. A plan's own file says
what it changes; this list is the only place that says when.

1. `void-1.9.md`: Void 1.8.0 to 1.9.1. pnpm installs a release only once it's 24 hours old, so not
   before 2026-11-15 03:27 UTC (1.9.1 was published 2026-11-14 03:27 UTC).
2. `primitives.md`: void-fbtee's missing primitives, moved out of the example into the package.
3. `use-cases.md`: one event, many people, as data, built on the primitives.
4. `video-conferencing.md`: `void-moq`, built on all of the above.

Waiting on others, not in the order:

- `fbtee-issues.md`: two issues for fbtee (locale matching on a server, and two things in Arabic),
  drafted, filed only with the user's OK.
- `void-form-without-javascript.md`: waits on Void (an issue drafted for voidzero-dev/void, filed
  only with the user's OK).
- `many-languages.md`: what grows (Worker size, catalogs per request, hreflang, sitemap) when an
  app has every language. To measure first.
- `quiet-harbor-atlas.md`: the long plan, steps 1–8 done. Steps 9 (sign-in) and 10 (API routes with
  a language) wait until the example needs them, and "Still open" has the preview-AI note, the
  user's call.

A plan that's finished is deleted; git keeps it.
