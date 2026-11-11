# Translating markdown pages

Markdown pages (`@void/md`) are translated as whole files: one copy per locale.

## Where things are

- The original is under `pages/<source locale>/`, e.g. `pages/en-US/blog/hello.md`.
- Each translation is the same path under the locale's URL segment, e.g.
  `pages/th-TH/blog/hello.md`. The segment is the locale unless `vite.config.ts` sets another.

## What to translate

- **Text:** headings, paragraphs, lists, link text, image alt text.
- **Frontmatter values meant for people** (`title`, `description`). Keep the keys, and keep values
  that are data (`date`, numbers, slugs, file names) as they are.

## What to keep exactly

- The `<script>` block at the top. @void/md needs it first in the file, and its import paths stay
  the same: the page sits at the same depth under another locale folder.
- Components and islands such as `<PostMeta />`, with their props. They translate their own text
  through fbtee catalogs.
- Code blocks, inline code, URLs and HTML attributes.
- The page's structure: the same headings and sections in the same order, so the locales match.

## translatedFrom

Each translated page records which version of the original it came from, as
`translatedFrom: "<hash>"` in its frontmatter. `void-fbtee check` compares it with the original
and reports a page as out of date when the original changes.

Don't write the hash yourself. `void-fbtee translate` records it for the pages it had translated.
After translating by hand, run `void-fbtee stamp pages/<locale>/<path>.md`.

For a page that is out of date, compare it with the original and change only what changed.
