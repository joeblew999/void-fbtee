# plans/language-picker.md: choosing a language when there are a hundred

Status: built 2026-11-15, on the user's word. It replaces `plans/language-notice.md`
(the visitor's own languages, shown first here, are what the notice was for) and the header item
of `plans/many-languages.md`. Its place in the order: `plans/README.md`.

## Why

The example's header (`apps/example/src/shell/SiteHeader.tsx:66–90`) shows this page in every
language, one link each. That's three links today and would be a hundred across the top of every
page once the app has every language (the user, 2026-11-14), which is where it's headed.

What's left of the header links' job, now that `"/"` sends each visitor to their own language
(`plans/their-own-language.md`, done), is someone choosing another language on purpose, and someone
who arrived on a page in a language that isn't theirs (a shared link, a browser that kept the old
permanent redirect to `/en-US`). The reason the header's comment also gives, "so crawlers find
every language version", is already covered: every page lists its versions in its head and in the
sitemap.

Every app with many languages has this problem, so it's solved once, in the package.

## What fbtee has for this

Checked in fbtee 6.0.0 (its README, "Locale Context", and `lib/index.d.mts`'s exports, 2026-11-15):
no picker component. What it has:

- **Choosing from the browser's languages:** `createLocaleContext({ clientLocales:
  navigator.languages, … })`, by its matching rule. The picker's "yours first" uses that same
  rule, through `negotiate()` (a copy of it, tested equal; `plans/their-own-language.md`).
- **Names for the languages:** `availableLanguages`, a map the app writes by hand (`['de-DE',
  'Deutsch']`). The picker names them with `Intl.DisplayNames` instead, which has every language's
  name in every language, so an app writes none; an app can still pass its own for a language
  where it wants another (`names={{ "zh-Hant": "繁體中文" }}`), as fbtee's map does.
- **Changing the language in place:** `useLocaleContext().setLocale()`. Not used: with void-fbtee
  each language has its own address, so a choice is a link to it (the skill says why).
- **Its own text, translated:** the picker has words of its own: its label, the search box's
  placeholder, and the "yours" mark. A package can't ship English text into an app's catalogs
  (prepare collects the app's own code), so they're props, written by the app in fbtee as any of
  its strings (`label={fbs("Language", "…")}`), translated with the rest. Left out, the picker has
  no words: the current language's name for the label, no placeholder, and the mark as an
  attribute only.

## The rule it keeps

From `plans/their-own-language.md`: a visitor's language comes only from their locale or the
address, and nothing is remembered. So every entry in the picker is a plain link to this page at
that language's address: no cookie, no browser storage, no setting.

## What it is

`<LanguagePicker />` from `void-fbtee/react`, for an app's header or footer.

**The package gives what it does, not how it looks.** It ships no CSS and no class names of its
own: it renders plain, accessible markup, each part with a `className` prop and a `data-part`
attribute (`summary`, `search`, `yours`, `list`, `item`), and the states as attributes
(`data-current`, `data-yours`, `open`), so an app styles it with its own system (Tailwind, CSS, its
own design components), as the header's links are styled today. The package's job is the
behaviour, the order, the names, the links and the accessibility; the look is the app's, and the
example's lives in the example.

1. **One control, the same size for 3 languages or 300.** It shows the current language's name,
   named in its own language (`ไทย`). Opening it shows the list.
2. **The visitor's own languages first.** At the top, the languages from the visitor's own list
   (`navigator.languages`) that the app has, best first, matched by the same `negotiate()` that
   `"/"` uses (`packages/void-fbtee/src/negotiate.ts`), without the fallback. Usually it's one, and
   it's the one they want. When it isn't the page's language, it's marked as theirs: that's the
   notice's job, done here.
3. **Then every language, findable:**
   - each one named in its own language and in the page's (`ไทย · Thai` on an English page), by
     `Intl.DisplayNames`, from the language subtag where the app has one variant of the language
     (`th`, not `th-TH`: `of("th-TH")` is "ไทย (ไทย)", Node, 2026-11-14), and from the full tag
     where it has several (`en-GB` and `en-US` both on the list);
   - sorted the page language's way, by `Intl.Collator` in the page's locale;
   - a search box that filters as you type, on either name or the code (`th`, `ar-EG`), ignoring
     case and accents.
4. **Each entry** is a link to this page at that language's address (`/<segment><path>`, as the
   header's links are now), with `hreflang` and, for the current one, `aria-current`; its name
   carries the language's own `lang` and `dir`. Not the whole link: there, Arabic's `rtl` turned
   its row round, its two names the other way from every other row (seen in Chromium, 2026-11-15).

**It works without JavaScript.** The control is a `<details>` and `<summary>`: the browser opens and
closes it, keyboard included, with no script. Inside is the plain list of links, sorted, so it
works on markdown pages and island pages, whose layouts Void renders "static only, so they are not
hydrated on the client" (`node_modules/void/docs/guide/pages-routing/islands.md`, "Layouts", read
2026-11-14). The search box and "yours first" are added by a small script once the page has loaded,
on every kind of page, hydrated or not (how, below). Without it, the list is still complete and in
order.

**The same for everyone in the cache.** The server renders the same list for everyone (the
`Accept-Language` header isn't read, so the page stays cached once per language); "yours first" is
the browser's own work after load, inside the closed `<details>`, so nothing moves on screen.

## Settled when building (2026-11-15, Void 1.8.0)

- **The script:** none. The search box and "yours first" are the component's own React, after
  hydration (`useHydrated()`). On code pages the root layout hydrates, so they're there; on
  markdown and island pages it doesn't, and the picker is the full plain list, which still works.
  Simpler than a script in every page's head, and nothing outside React touches React's DOM.
- **Names Intl doesn't have:** `Intl.DisplayNames` with `fallback: "code"` gives the code itself.
- **Styling:** none in the package; the example's is `className`s in `SiteHeader.tsx`.
- **Storage:** Void itself keeps scroll positions in `sessionStorage` (`void:scroll:…`,
  `void/dist/pages/client.mjs`); the test allows those and nothing else.

## To check first, on the Void the repo runs then

- How the script runs on every kind of page. Two candidates: an inline `<script>` the component
  renders (inside `#app` on hydrated pages, where React must hydrate it without a mismatch), or the
  middleware adding it to every page's head (Void's head `script`, "set in middleware to apply
  defaults to every page", `head.md`), keeping one an earlier middleware set. The second avoids
  hydration entirely; the first keeps it in the component. Settled with a probe on a code page, an
  island page and a markdown page.
- `Intl.DisplayNames` in the page's language for every language: what it gives where it has no
  name (the code itself, or `undefined`), in Node, workerd, Chromium and WebKit, and the plan's
  fallback (the code).

## What changes

- **Package (`packages/void-fbtee/`):**
  - `src/react.tsx`: `<LanguagePicker />`, unstyled: `className` per part, `data-part` and state
    attributes, no CSS; its words (`label`, `placeholder`, `yours`) and any `names` as props;
  - the script that adds search and "yours first" (where, from "To check first");
  - `README.md` and `skills/void-fbtee/SKILL.md`: what it is and the rule it keeps.
- **Example (`apps/example/`):**
  - `src/shell/SiteHeader.tsx`: the row of language links (`:66–90`) goes, `<LanguagePicker />` in
    its place, and its opening comment says why;
  - `src/shell/SiteHeader.tsx` again: its words in fbtee (`fbs`), translated by
    `i18n:translate` with the app's other strings; its look, with the example's own `buttonVariants` and
    Tailwind classes passed as `className`, as its links have now; `pages/style.css` only if a
    state (`[open]`, `[data-yours]`) needs a rule Tailwind can't say in a class.
- **Plans:**
  - `plans/language-notice.md` is deleted: its job is point 2 above;
  - `plans/many-languages.md` drops the header item;
  - `plans/README.md` puts this plan in the order.
- **Tests** (below); the existing tests that use the header's `to-<locale>` links move to the
  picker's.

## How we'll know it's right

Real browsers, Chromium and WebKit (`e2e/browsers/`), on a code page, an island page and a
markdown page (`/en-US/docs/intl`, `/en-US/docs`, `/en-US/docs/tour`), in English and in Arabic
(right to left):

- closed, it shows the current language's own name; opened, every language the app has, each
  linking to this page in that language, with `lang`, `dir` and `hreflang`;
- a Thai browser (`locale: "th-TH"`) on an English page sees Thai first, marked as theirs; an
  English browser sees English first, not marked;
- typing `thai`, `ไทย` or `th` leaves Thai; typing a name with or without its accents finds it;
- with JavaScript off, it opens, lists every language in order, and every link works;
- following one lands on the same page in that language; nothing is stored (no cookie, no
  `localStorage` or `sessionStorage`), and the page still caches once per language (the existing
  cache tests);
- the page hydrates with no errors;
- its words are the app's, in the page's language (Thai on a Thai page), and `i18n:check` is
  clean;
- the package adds no CSS: its build has no stylesheet, and the picker with no `className` renders
  no `class` attributes at all.

A unit test renders it with a hundred languages: every one listed once, in the page language's
order, the visitor's own first, and search finding any of them by either name or code.

Then `vp check`, `test:unit`, `test:dev`, `test:preview`, `i18n:check`, committed locally, and
pushed when the user says.
