---
name: void-fbtee example
description: The void-fbtee demo site, in Void's family look - always dark, white ink, one violet accent, system fonts.
colors:
  brand: "oklch(0.68 0.19 285)"
  ground: "oklch(0.2 0.012 275)"
  panel: "oklch(0.225 0.012 275)"
  well: "oklch(0.25 0.012 275)"
  raised: "oklch(0.27 0.014 275)"
  ink: "oklch(0.985 0 0)"
  ink-muted: "oklch(0.74 0.012 275)"
  rule: "oklch(1 0 0 / 12%)"
  field-stroke: "oklch(1 0 0 / 16%)"
  destructive: "oklch(0.704 0.191 22.216)"
typography:
  display:
    fontFamily: "system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.556
  lead:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.556
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.525rem"
  4xl: "0.975rem"
spacing:
  tight: "8px"
  gap: "12px"
  gutter: "16px"
  code: "20px"
  cell: "24px"
  hero: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  nav-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  nav-item-current:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  input:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "2px 8px"
    height: "20px"
  code-window:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "{spacing.code}"
  code-tab:
    textColor: "{colors.ink-muted}"
    padding: "10px 16px"
  code-tab-current:
    textColor: "{colors.ink}"
    padding: "10px 16px"
  terminal-window:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
    padding: "{spacing.code}"
  feature-cell:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    padding: "{spacing.cell}"
  text-link:
    textColor: "{colors.brand}"
    typography: "{typography.label}"
  sidebar-link:
    textColor: "{colors.ink-muted}"
    padding: "4px 0"
  sidebar-link-current:
    textColor: "{colors.brand}"
    padding: "4px 0"
  docs-pager:
    textColor: "{colors.brand}"
    rounded: "{rounded.md}"
    padding: "{spacing.gutter}"
---

# Design System: void-fbtee example

## Overview

**Creative North Star: "The Workbench in Void's Livery"**

The site is a developer-tool page in Void's own family look (benchmark: void.cloud), played straight. Its centrepiece is real code and the line that code renders in the page's own language; everything around it is quiet so that proof carries the page. A near-black ground with a faint blue cast, white ink, one violet accent, and 1px rules that divide sections into a grid. No gradient heroes, no glow, no marketing claims.

The world is always dark. `void.config.ts` sets `head.htmlAttrs` to `class="dark"` and `data-theme="dark"` on `<html>` of every page (no wrapper class): `dark` turns on the `.dark` palette in `pages/style.css`, and `data-theme="dark"` keeps @void/md's markdown and code colours dark whatever the device's setting. The `:root` block in `pages/style.css` is shadcn's light default and is never shown. Density is moderate: a 72rem container, generous hero spacing, compact controls.

The site ships in several languages, including Arabic, so right-to-left is a first-class requirement of the visual system, not an afterthought. Which languages appear comes from the app's locales (`useLocales()`), never from a hard-coded list.

**Key Characteristics:**

- Always dark: `class="dark"` and `data-theme="dark"` on `<html>`, from `void.config.ts`.
- One violet accent (`--brand`), used sparingly.
- System fonts only: system-ui sans and the platform mono, no web fonts.
- 1px rules divide sections into ruled grids; surfaces are flat.
- Code windows with file tabs, and a terminal window beside them, are the signature elements.
- Right-to-left first-class: logical properties, mirrored arrows, code stays left-to-right.

## Colors

A cool near-black ground with white ink and a single violet accent; every neutral carries the same faint blue cast (hue 275).

### Primary

- **Void Violet** (oklch(0.68 0.19 285)): the only accent (`--brand`, also `--ring` and `--sidebar-primary`). Tag names in highlighted code, the `$` prompts in the terminal window, the arrows in the ruled grids, the feature icons and their 4px fact dots, inline text links ("Read more", "Read the full setup"), the current page in the docs sidebar, the titles in the docs previous/next boxes and their hover border, the underline under the current language in the header, markdown links, focus rings, and text selection (45% mixed with transparent).

### Neutral

- **Night Ground** (oklch(0.2 0.012 275)): `--background`, and `body` behind the layout. The page itself.
- **Panel** (oklch(0.225 0.012 275)): `--card` and `--popover`. Code windows, cards.
- **Well** (oklch(0.25 0.012 275)): `--muted`. Hover fills (at 50%), the code window's output strip (at 40%), markdown soft backgrounds.
- **Raised** (oklch(0.27 0.014 275)): `--secondary` and `--accent`. The current nav item, secondary badges.
- **White Ink** (oklch(0.985 0 0)): `--foreground`, and `--primary`, so the primary button is white with ground-coloured text.
- **Muted Ink** (oklch(0.74 0.012 275)): `--muted-foreground`. Intro copy, card text, the footer, strings and expressions in code, the non-current language links.
- **Rule** (oklch(1 0 0 / 12%)): `--border`. Every 1px rule: header and section borders, grid dividers, the file tabs' edges, the docs sidebar menu and "On this page" rail. In the feature grid it is also the grid's own background, showing through 1px gaps.
- **Field Stroke** (oklch(1 0 0 / 16%)): `--input`. Input and outline-button strokes; at 30% as their fill.
- **Destructive** (oklch(0.704 0.191 22.216)): errors, invalid fields, the sold-out badge.

### Named Rules

**The One Voice Rule.** Violet is the only hue on the page. It marks what to look at (code tags, prompts, arrows, icons, links, the current page and language, focus) and never fills a surface or a button; its only fills are the 4px fact dots.

**The White Button Rule.** The primary action is white ink on the ground colour, not violet. The accent stays a pointer, not a fill.

## Typography

**Display Font:** system-ui (with sans-serif)
**Body Font:** system-ui (with sans-serif)
**Label/Mono Font:** the platform mono (Tailwind's default stack: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)

**Character:** The device's own fonts, which cover English, Arabic and Thai with nothing to download. Headings sit at medium weight with slightly tight tracking; code is in the platform mono.

### Hierarchy

- **Display** (500, 3rem rising to 3.75rem from 768px, line-height 1.05, balanced): the home page's one heading.
- **Headline** (500, 1.875rem): inner page titles (Events, an event, Formats); the docs index title at 2.25rem. Home section headings are 500 at 1.875rem rising to 2.25rem from 768px, balanced; the closing call is 2.25rem rising to 3rem.
- **Title** (500, 1.25rem): headings in the ruled page grid; the code window's rendered line is 500 at 1.5rem; Formats section headings are 500 at 1.5rem over a 1px rule.
- **Subtitle** (500, 1.125rem): feature headings (h3) and the docs index's group headings.
- **Lead** (400, 1.125rem, max 36rem, muted ink, pretty-wrapped): the home intro.
- **Body** (400, 1rem, line-height 1.5): running text and markdown.
- **Label** (500, 0.875rem): buttons and inline violet links; nav items at 0.8rem; file tabs and language name at 0.75rem. Sidebar group, "On this page" and footer column headings are 600 at 0.875rem; sidebar, outline and footer links 400 at 0.875rem in muted ink.
- **Code** (400, 0.875rem, line-height 1.625): code windows. The terminal window is 0.75rem on a phone and 0.875rem from 640px, at line-height 2.

### Named Rules

**The System Fonts Rule.** system-ui for all text and the platform mono for code. No web fonts, ever (a PRODUCT.md brand commitment).

**The Joined Letters Rule.** h1 and h2 get -0.025em letter-spacing, except in right-to-left pages, where it is `normal`: Arabic letters join, and tracking breaks them apart.

**The Kept Whole Rule.** A file or tool name inside a translated sentence must not break or flip: pass it to the sentence as `<bdi dir="ltr" class="whitespace-nowrap">` (the `file()` helper in `components/HomeSections.tsx`). Terminal commands break only between words (each word `whitespace-nowrap`), so "ar-EG" never splits into what reads as another command.

## Layout

One centred container, 72rem wide (`max-w-6xl`) with a 16px gutter, shared by the header, `main` (32px vertical padding) and the footer. The home hero is two columns from 1024px (`1fr 1.1fr`, 48px gap, 80px vertical padding from 768px): heading, intro and two buttons on one side, the code window on the other; on a phone they stack in that order. Below it the home page runs, each section opened by a top rule and 64px of vertical padding: "Add it to a Void app" (text beside the terminal window, the hero's `1fr 1.1fr` from 1024px, 40px gap); the six features in a ruled grid (one column, two from 640px, three from 1024px); the page links in a three-column ruled grid from 640px (a border above and below, 1px rules between cells, 24px cell padding), stacked with rules between them on a phone; and the closing call (80px above, 48px below).

The docs are laid out like VitePress: a 13rem sidebar and the page from 768px (40px gap), plus a 12rem "On this page" column from 1280px when the page has headings. On a phone the sidebar becomes a "Pages" menu above the page, between two rules. The docs index is a two-column ruled grid of the sidebar's groups from 640px.

The footer is three link columns from 640px (Docs, Project, Built with), 48px vertical padding, under a top rule.

The header is sticky, 56px tall, one row on desktop; on a phone the page links drop to a second row that scrolls sideways.

**The Ruled Gap Rule.** For a grid whose column count changes, draw the rules with `gap-px` over a `bg-border` grid, each cell on the ground colour, so 1px rules fall between cells at any count. All direction-dependent spacing uses logical properties (`ps`/`pe`, `ms-auto`, `border-e`, `inline-start`), so layouts mirror in right-to-left pages with no extra rules.

**The Logical Sides Rule.** Never use left/right for spacing, borders or floats; use start/end. Where a dependency uses physical sides (the @void/md heading anchors), override it with logical ones, as `pages/style.css` does.

## Elevation & Depth

Flat by default, with tonal layering: ground, a slightly lighter panel for code windows and cards, and 1px translucent white rules for structure. There is one shadow in the system, under the home page's two windows (code and terminal), which lifts them off the page.

### Shadow Vocabulary

- **Window lift** (`box-shadow: 0 24px 60px -24px rgb(0 0 0 / 0.6)`): the home code window and terminal window only.

**The Rules Not Shadows Rule.** Divide and group with 1px rules (`--border`). Shadows are reserved for the code and terminal windows.

## Shapes

Small, consistent radii from a 0.375rem (6px) base: buttons, inputs, selects and code windows at 6px; small buttons at 4.8px; cards at 8.4px; badges fully pill-shaped at 0.975rem; the docs previous/next boxes at 4.8px; fact dots are 4px circles. Ruled grids and docs sections have square corners. Rules are 1px. Icons are Lucide's, at 16-20px. Arrows are Lucide's `ArrowRight` and are mirrored in right-to-left pages with `rtl:-scale-x-100` (and their hover nudge reversed with `rtl:group-hover:-translate-x-1`, or `-translate-x-0.5` on inline links). The docs phone menu's `ChevronDown` turns 180° when open (200ms).

## Components

Rectangular, quiet controls from shadcn/ui (base-nova style, RTL on), with the site's palette carrying the character.

### Buttons

- **Shape:** gently rounded (6px; 4.8px at size `sm`).
- **Primary:** white ink fill, ground-coloured text, 500 weight at 0.875rem; on the home page 44px tall with 20px inline padding and a trailing mirrored arrow. Hover drops the fill to 80%.
- **Home rows:** the hero has three: "Try the events demo" (primary), then "Docs" and "View on GitHub" (outline). The closing call has "Get started" (primary) and "View on GitHub". One primary per row.
- **Outline:** field-stroke border and a 30% field-stroke fill on the ground; hover to 50%.
- **Ghost / Secondary:** used in the header nav: ghost for links, secondary (raised fill) for the current page.
- **Focus:** ring-coloured border plus a 3px violet ring at 50%; pressed moves down 1px.

### Chips (Badges)

- **Style:** 20px pill, 0.75rem 500 weight; secondary on raised fill, destructive on a 20% red tint.

### Cards / Containers

- **Corner Style:** 8.4px.
- **Background:** panel, with a 1px ring of white ink at 10%.
- **Shadow Strategy:** none.
- **Internal Padding:** 16px (12px at size `sm`).

### Inputs / Fields

- **Style:** 32px tall, 6px radius, field-stroke border, 30% field-stroke fill.
- **Focus:** ring-coloured border with a 3px violet ring at 50%.
- **Error / Disabled:** destructive border and ring; disabled at 50% opacity.

### Links

- **Inline link:** violet, 500 weight, with a 16px mirrored arrow that nudges 2px toward the end on hover (200ms): "Read the full setup", the features' "Read more".
- **List links** (sidebar, outline, footer, docs index): muted ink at 0.875rem, white ink on hover (150ms).

### Navigation

- **Header:** sticky, ground background, bottom rule. Wordmark "void-fbtee" at 600 weight; page links Home · Demo · Docs as small ghost buttons, the current one secondary with `aria-current="page"`. Language links at the end, each named in its own language (`Intl.DisplayNames`), muted when not current, the current one in white ink with a 2px violet underline offset 8px. After them a plain muted "GitHub" link, set off by a start-side rule (8px margin, 16px padding).
- **Footer:** three columns, each a 0.875rem 600 heading over list links: Docs (built from the docs sidebar, so the two always match), Project (Demo, GitHub, Releases), Built with (tool names, not translated).
- **Docs sidebar:** groups (Start here, Guides, Reference, The demo), each a 0.875rem 600 heading over its links; the current page in violet at 500 weight with `aria-current="page"`. Sticky 80px from the top. On a phone it sits inside a `<details>` "Pages" menu with a turning chevron, no JavaScript.
- **On this page:** from 1280px, a sticky rail with a start-side rule and 16px start padding; h3 entries indented 12px.
- **Previous / next:** two boxes under a top rule (64px above the rule), each with a 1px rule, 4.8px radius, 16px padding: a 0.75rem muted label over a violet 500 title; the next box aligned to the end. Hover turns the border violet (150ms).

### Code Window (signature)

A panel with a 6px radius, a 1px rule and the window lift. Its top bar holds three file tabs (`index.tsx`, `vite.config.ts`, `th-TH.json`; 0.75rem mono, 10px by 16px, each closed by an end-side rule) with the page's language name at the far end from 640px. The tabs follow the ARIA tabs pattern: one Tab stop, arrow keys move between files, and the tablist is `dir="ltr"` so it reads the same in every language. The open tab is white ink on the ground at 60%; the others are muted ink, white on hover. The code panel keeps a minimum height of 18rem so switching files never moves the page. The code is `dir="ltr"` in every language, 0.875rem mono, 20px padding, scrolling sideways with a rule-coloured scrollbar. Colouring follows Void's site: tags in violet, attribute names in white ink, strings and expressions in muted ink. Below a rule, the output strip (well at 40%) shows the line as this page renders it, at a fixed minimum height so switching language never shifts the layout.

### Terminal Window (signature)

The code window's sibling: same panel, rule, radius and lift, captioned "Terminal" in 0.75rem muted mono. It shows the README's install commands, `dir="ltr"`, each line prefixed by a violet, unselectable `$ `. Lines wrap only between words, with a 2ch hanging indent on a phone, so every command stays readable.

### Feature Grid (signature)

Six features in a ruled grid (`gap-px` over `bg-border`, rules above and below). Each cell, on the ground at 24px padding: a 20px violet Lucide icon, a 1.125rem 500 heading, three facts in 0.875rem muted ink each after a 4px violet dot, and a violet "Read more" link to the docs page on it, pinned to the cell's foot.

### Docs Pages

- **Markdown pages:** in an `article.void-md`, styled by @void/md's content theme with its colours mapped to the site's in `pages/style.css` (`:root[data-theme] .void-md`, which ties with the theme's own dark rule and wins by coming later): body font, ink, muted ink, violet links, rule borders, well soft backgrounds.
- **Docs index:** a 2.25rem title over a two-column ruled grid of the sidebar's groups (24px cells), each a 1.125rem heading over list links that end in a 16px violet arrow.
- **Formats:** each section a 1.5rem 500 heading over a 1px rule, then its table; the page's two interactive panels stay cards.

### Ruled Page Grid (signature)

Links to the site's pages in a grid bounded by rules above and below, with 1px rules between cells. Each cell: a title at 1.25rem 500 with a violet arrow at the end, muted text below, 24px padding. Hover fills the cell with well at 50% and nudges the arrow 4px toward the end (200ms); focus draws a 2px violet outline inset by 2px.

## Do's and Don'ts

### Do:

- **Do** keep the site dark on every page: `class="dark"` and `data-theme="dark"` on `<html>`, set once in `void.config.ts`.
- **Do** use `--brand` (oklch(0.68 0.19 285)) as the only accent, for pointers, never for fills.
- **Do** use system-ui for text and the platform mono for code.
- **Do** use logical properties for every direction-dependent style, and mirror arrows with `rtl:-scale-x-100`.
- **Do** keep code blocks `dir="ltr"` in every language.
- **Do** list languages from the app's locales, each named in its own language.
- **Do** divide sections with 1px rules (`--border`, oklch(1 0 0 / 12%)).
- **Do** keep file and tool names in translated sentences whole and left-to-right with `<bdi dir="ltr" class="whitespace-nowrap">`.
- **Do** take the repository's address from `lib/project.ts` (`REPO`, `RELEASES`), never a copy of the URL.

### Don't:

- **Don't** load web fonts.
- **Don't** add letter-spacing to headings in right-to-left pages.
- **Don't** hard-code the list of languages.
- **Don't** use gradient heroes, glow or marketing claims.
- **Don't** use left/right for spacing, borders or floats.
- **Don't** style anything from the `:root` light palette; it is never shown.
- **Don't** put a theme class on a wrapper element; the theme lives on `<html>`.
