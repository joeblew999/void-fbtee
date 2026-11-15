# The translator test's data

Everything the translator test (`vp run test:translator`, e2e/translator/) runs on, kept as data
so a change to it shows as a diff beside the scores it produced:

- `app/`: an app in fbtee's own format. `app/src/strings.tsx` holds the test strings as real
  `<fbt>` strings with their descriptions, each testing one thing a translation can get wrong.
  `app/i18n/translations/<locale>.json` are its catalogs, as fbtee's prepare makes them, every
  entry translated: the references the test scores against. Written by Claude Code on 2026-11-15,
  not yet reviewed by native speakers. fbtee's own built-in strings are in them too, marked
  translated as their English source: they aren't test strings.
- `verdicts.json`: what a person decided about an answer, by locale, then the entry's hash: each
  answer read (its lines joined by "\n"), right or wrong, why when wrong, who and when.
- `scores.json`: each run's results, written by the test, never by hand.

Adding a language: add it to `app/vite.config.ts`, run the data test (`vp test`), which says what
its catalog lacks, and translate every entry. Adding a string: add it to `app/src/strings.tsx`
and its translation to every catalog.
