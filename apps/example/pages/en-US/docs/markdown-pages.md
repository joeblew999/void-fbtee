<script>
import Fmt from "../../../components/Fmt.tsx" with { island: "load" }
</script>

# Translating markdown pages

Markdown pages (`@void/md`) are translated as whole files: one copy per locale.

## Where things are

- The original is under `pages/<source locale>/`, e.g. `pages/en-US/tour/index.md`.
- Each translation is the same path under the locale's URL segment, e.g.
  `pages/th-TH/tour/index.md`. The segment is the locale unless `vite.config.ts` sets another.

## What to translate

- **Text:** headings, paragraphs, lists, link text, image alt text.
- **Frontmatter values meant for people** (`title`, `description`). Keep the keys, and keep values
  that are data (`date`, numbers, slugs, file names) as they are.

## What to keep exactly

- The `<script>` block at the top. @void/md needs it first in the file, and its import paths stay
  the same: the page sits at the same depth under another locale folder.
- Components and islands such as `<EventTime startsAt="…" />`, with their props: props are data,
  the same in every copy. Components translate their own text through fbtee catalogs.
- Code blocks, inline code, URLs and HTML attributes. One exception: a link to another page of
  this site points to that page in the copy's language (`/th-TH/events` in the Thai copy).
- The page's structure: the same headings and sections in the same order, so the locales match.

## Dates, times and numbers

Don't write them out as text: a date written out is only text, so every copy has to redo it by
hand, and it can't show the reader's own time. Put the value in a component that formats it with
`Intl`, imported as an island in the `<script>` block. The tour does this with
`<EventTime startsAt="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />`: it shows in the reader's
language, on the event's clock and on theirs.

For a single value there's `<Fmt>` (`components/Fmt.tsx`). This page uses it, so each line below
is formatted for you, in this page's language:

- A number: <Fmt num="1234567.891" />
- Money: <Fmt money="1299" currency="THB" />
- A time, on its place's clock: <Fmt when="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- The same time, on yours: <Fmt yours="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- How far off it is: <Fmt ago="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- Languages, named in yours: <Fmt langs="en-US,ar-EG,th-TH" />

## translatedFrom

Each translated page records which version of the original it came from, as
`translatedFrom: "<hash>"` in its frontmatter. `void-fbtee check` compares it with the original
and reports a page as out of date when the original changes.

Don't write the hash yourself. `void-fbtee translate` records it for the pages it had translated.
After translating by hand, run `void-fbtee stamp pages/<locale>/<path>.md`.

For a page that is out of date, compare it with the original and change only what changed.
