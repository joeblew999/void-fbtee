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
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.025em"
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
---

# Design System: void-fbtee example

## Overview

**Creative North Star: "The Workbench in Void's Livery"**

The site is a developer-tool page in Void's own family look (benchmark: void.cloud), played straight. Its centrepiece is real code and the line that code renders in the page's own language; everything around it is quiet so that proof carries the page. A near-black ground with a faint blue cast, white ink, one violet accent, and 1px rules that divide sections into a grid. No gradient heroes, no glow, no marketing claims.

The world is always dark. The layout wrapper in `pages/layout.tsx` carries the `dark` class on every page, which turns on the `.dark` palette in `pages/style.css`; the `:root` block in that file is shadcn's light default and is never shown. Density is moderate: a 72rem container, generous hero spacing, compact controls.

The site ships in several languages, including Arabic, so right-to-left is a first-class requirement of the visual system, not an afterthought. Which languages appear comes from the app's locales (`useLocales()`), never from a hard-coded list.

**Key Characteristics:**

- Always dark: the `.dark` palette, applied by the layout wrapper.
- One violet accent (`--brand`), used sparingly.
- System fonts only: system-ui sans and the platform mono, no web fonts.
- 1px rules divide sections into ruled grids; surfaces are flat.
- Code windows with a file tab are the signature element.
- Right-to-left first-class: logical properties, mirrored arrows, code stays left-to-right.

## Colors

A cool near-black ground with white ink and a single violet accent; every neutral carries the same faint blue cast (hue 275).

### Primary

- **Void Violet** (oklch(0.68 0.19 285)): the only accent (`--brand`, also `--ring` and `--sidebar-primary`). Tag names in highlighted code, the arrows in the ruled page grid, the underline under the current language in the header, markdown links, focus rings, and text selection (45% mixed with transparent).

### Neutral

- **Night Ground** (oklch(0.2 0.012 275)): `--background`, and `body` behind the layout. The page itself.
- **Panel** (oklch(0.225 0.012 275)): `--card` and `--popover`. Code windows, cards.
- **Well** (oklch(0.25 0.012 275)): `--muted`. Hover fills (at 50%), the code window's output strip (at 40%), markdown soft backgrounds.
- **Raised** (oklch(0.27 0.014 275)): `--secondary` and `--accent`. The current nav item, secondary badges.
- **White Ink** (oklch(0.985 0 0)): `--foreground`, and `--primary`, so the primary button is white with ground-coloured text.
- **Muted Ink** (oklch(0.74 0.012 275)): `--muted-foreground`. Intro copy, card text, the footer, strings and expressions in code, the non-current language links.
- **Rule** (oklch(1 0 0 / 12%)): `--border`. Every 1px rule: header and section borders, grid dividers, the file tab's edge.
- **Field Stroke** (oklch(1 0 0 / 16%)): `--input`. Input and outline-button strokes; at 30% as their fill.
- **Destructive** (oklch(0.704 0.191 22.216)): errors, invalid fields, the sold-out badge.

### Named Rules

**The One Voice Rule.** Violet is the only hue on the page. It marks what to look at (code tags, arrows, the current language, focus) and never fills a surface or a button.

**The White Button Rule.** The primary action is white ink on the ground colour, not violet. The accent stays a pointer, not a fill.

## Typography

**Display Font:** system-ui (with sans-serif)
**Body Font:** system-ui (with sans-serif)
**Label/Mono Font:** the platform mono (Tailwind's default stack: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)

**Character:** The device's own fonts, which cover English, Arabic and Thai with nothing to download. Headings sit at medium weight with slightly tight tracking; code is in the platform mono.

### Hierarchy

- **Display** (500, 3rem rising to 3.75rem from 768px, line-height 1.05, balanced): the home page's one heading.
- **Headline** (600, 1.875rem): inner page titles (Events, an event, Formats).
- **Title** (500, 1.25rem): headings in the ruled page grid; the code window's rendered line is 500 at 1.5rem.
- **Lead** (400, 1.125rem, max 36rem, muted ink, pretty-wrapped): the home intro.
- **Body** (400, 1rem, line-height 1.5): running text and markdown.
- **Label** (500, 0.875rem): buttons; nav items at 0.8rem; file tab and language name at 0.75rem.
- **Code** (400, 0.875rem, line-height 1.625): code windows.

### Named Rules

**The System Fonts Rule.** system-ui for all text and the platform mono for code. No web fonts, ever (a PRODUCT.md brand commitment).

**The Joined Letters Rule.** h1 and h2 get -0.025em letter-spacing, except in right-to-left pages, where it is `normal`: Arabic letters join, and tracking breaks them apart.

## Layout

One centred container, 72rem wide (`max-w-6xl`) with a 16px gutter, shared by the header, `main` (32px vertical padding) and the footer. The home hero is two columns from 1024px (`1fr 1.1fr`, 48px gap, 80px vertical padding from 768px): heading, intro and two buttons on one side, the code window on the other; on a phone they stack in that order. Below it, the page links sit in a three-column ruled grid from 640px (a border above and below, 1px rules between cells, 24px cell padding), stacked with rules between them on a phone.

The header is sticky, 56px tall, one row on desktop; on a phone the page links drop to a second row that scrolls sideways. All direction-dependent spacing uses logical properties (`ps`/`pe`, `ms-auto`, `border-e`, `inline-start`), so layouts mirror in right-to-left pages with no extra rules.

**The Logical Sides Rule.** Never use left/right for spacing, borders or floats; use start/end. Where a dependency uses physical sides (the @void/md heading anchors), override it with logical ones, as `pages/style.css` does.

## Elevation & Depth

Flat by default, with tonal layering: ground, a slightly lighter panel for code windows and cards, and 1px translucent white rules for structure. There is one shadow in the system, under the code window, which lifts the centrepiece off the page.

### Shadow Vocabulary

- **Code window lift** (`box-shadow: 0 24px 60px -24px rgb(0 0 0 / 0.6)`): the home code window only.

**The Rules Not Shadows Rule.** Divide and group with 1px rules (`--border`). Shadows are reserved for the code window.

## Shapes

Small, consistent radii from a 0.375rem (6px) base: buttons, inputs, selects and code windows at 6px; small buttons at 4.8px; cards at 8.4px; badges fully pill-shaped at 0.975rem. Rules are 1px. Arrows are Lucide's `ArrowRight` and are mirrored in right-to-left pages with `rtl:-scale-x-100` (and their hover nudge reversed with `rtl:group-hover:-translate-x-1`).

## Components

Rectangular, quiet controls from shadcn/ui (base-nova style, RTL on), with the site's palette carrying the character.

### Buttons

- **Shape:** gently rounded (6px; 4.8px at size `sm`).
- **Primary:** white ink fill, ground-coloured text, 500 weight at 0.875rem; on the home page 44px tall with 20px inline padding. Hover drops the fill to 80%.
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

### Navigation

- **Header:** sticky, ground background, bottom rule. Wordmark "void-fbtee" at 600 weight; page links as small ghost buttons, the current one secondary with `aria-current="page"`. Language links at the end, each named in its own language (`Intl.DisplayNames`), muted when not current, the current one in white ink with a 2px violet underline offset 8px.

### Code Window (signature)

A panel with a 6px radius, a 1px rule and the code-window lift. Its top bar is a file tab (`index.tsx`, 0.75rem mono, closed by an end-side rule) with the page's language name at the far end. The code is `dir="ltr"` in every language, 0.875rem mono, 20px padding, scrolling sideways with a rule-coloured scrollbar. Colouring follows Void's site: tags in violet, attribute names in white ink, strings and expressions in muted ink. Below a rule, the output strip (well at 40%) shows the line as this page renders it, at a fixed minimum height so switching language never shifts the layout.

### Ruled Page Grid (signature)

Links to the site's pages in a grid bounded by rules above and below, with 1px rules between cells. Each cell: a title at 1.25rem 500 with a violet arrow at the end, muted text below, 24px padding. Hover fills the cell with well at 50% and nudges the arrow 4px toward the end (200ms); focus draws a 2px violet outline inset by 2px.

## Do's and Don'ts

### Do:

- **Do** keep the site dark on every page; the `dark` class on the layout wrapper is the theme.
- **Do** use `--brand` (oklch(0.68 0.19 285)) as the only accent, for pointers, never for fills.
- **Do** use system-ui for text and the platform mono for code.
- **Do** use logical properties for every direction-dependent style, and mirror arrows with `rtl:-scale-x-100`.
- **Do** keep code blocks `dir="ltr"` in every language.
- **Do** list languages from the app's locales, each named in its own language.
- **Do** divide sections with 1px rules (`--border`, oklch(1 0 0 / 12%)).

### Don't:

- **Don't** load web fonts.
- **Don't** add letter-spacing to headings in right-to-left pages.
- **Don't** hard-code the list of languages.
- **Don't** use gradient heroes, glow or marketing claims.
- **Don't** use left/right for spacing, borders or floats.
- **Don't** style anything from the `:root` light palette; it is never shown.
