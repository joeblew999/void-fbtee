---
version: 1
slug: "components-docslayout-tsx"
primary_target: "components/DocsLayout.tsx"
related_targets: ["pages/[lang]/docs/index.island.tsx"]
---

Scope: the Docs (components/DocsLayout.tsx, the docs index, every page under /<locale>/docs/), visitor mode Read, inside the established world in DESIGN.md.
Audience: developers reading how to add and use void-fbtee. Task: find a page, read it, move to the next. Constraints: markdown pages are server-rendered with no JavaScript; every language, including right-to-left; titles and headings come from each language's markdown.

## Direction contract

THESIS: The Vite family's docs layout (VitePress), built on Void's own @void/md, so the docs are themselves translated by void-fbtee. It refuses a flat list of pages and a sideways-scrolling row on phones.

OWN-WORLD: DESIGN.md's world: near-black ground, white ink, the violet accent only to mark the current page and links, 1px rules, system fonts.

STORY: The reader sees the groups, opens a page, scans "On this page", reads, and follows the next-page link.

FIRST VIEWPORT: Desktop: grouped sidebar at the start edge, the page in the middle, "On this page" at the end edge (wide screens). Phone: a "Pages" menu that opens above the page.

FORM: VitePress's default docs layout; seed: none (pinned) — the user approved: "Docs layout, VitePress-style: a grouped sidebar on the left, the page in the middle, 'On this page' on the right, previous/next links at the bottom."

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
