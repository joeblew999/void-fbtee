# void-fbtee

i18n for [Void](https://void.cloud) apps: strings translated with
[fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, numbers and lists with
the platform's own `Intl`. An example app in three languages:
https://void-fbtee-example.gedw99.workers.dev

## What it is

A Void add-on, made of the same two kinds of part as Void's own `@void/md` and `@void/react`: a
Vite plugin (`import { voidFbtee } from "void-fbtee/plugin"`) plus the parts a Void app uses at run time:
`void-fbtee/middleware` (each request's language), `void-fbtee/react` (components and forms),
`void-fbtee/routes` (links in the current language) and `void-fbtee/server` (cache clearing in
every language, and code with no page: a scheduled job, a queue consumer, an email). With Zod 4,
validation messages are in the page's language too. The Vite plugin works only in a Void app: it swaps
modules in Void's server environment (Cloudflare's own Temporal, fbtee's per-request build, Void's
own Hono), and the rest goes where Void looks for it (`middleware/99.i18n.ts`, `void.config.ts`),
which `vp exec void-fbtee init` sets up and `vp build` checks. React only, as fbtee is. It works
with Vite+ and with plain Vite, and with npm and pnpm.

The rule it follows is the one for dates in a database: data stays neutral (UTC instants with zone
names, plain numbers with currency codes), both to the browser and back, and is formatted once,
for the screen. The server formats a page's text and the browser keeps it (`<Formatted>`), because
each browser engine ships its own locale data and writes some values differently. What only the
browser knows, such as the reader's own time zone, the browser formats, once it knows it: the
server leaves that space empty rather than showing a stand-in.

## What it needs

- **Node.js** 24.22 or later (26.12 or later on 26).
- **In the app** (void-fbtee's peers; `init` adds the ones the app hasn't got): Void and `@void/react`
  1.7 or later, React 19.2 or later, fbtee 6 (any 6.x: tested with 6.0.1), `temporal-polyfill` 1.0.8
  or later, and Vite 8 (plain, or Vite+'s).
- **React.** A Void app on Vue, Svelte or Solid can't use it: fbtee renders through React. `init`
  says so and stops.
- **Vite.** It's a Vite plugin: plain Rollup or Rolldown can't run it (it stops and says so).
- **Cloudflare's flags**, in `void.config.ts`: `temporal` (`init` adds it; `vp build` checks it), and
  `nodejs_als`, for `AsyncLocalStorage` in `void-fbtee/server` and translated content, which Void
  turns on itself.
- **To translate as you work** (`vp dev`), either or both of:
  - Gemini, through Void's AI: when the app's code imports `void/ai` (Void's `guide/ai.md`), signed
    in to Cloudflare (`vp exec void connect --platform cloudflare`);
  - Claude Code: `claude`, signed in on your machine (`claude auth status`).

  `init` says which you have. With neither, write the translations in `i18n/translations/` by hand:
  `vp build` stops until every string and page is translated, and its message lists them.

- **Optional:** Vite DevTools 0.8, for void-fbtee's panel (below).

## Add it to a Void app

From npm (not there yet: the first version is published by hand, then CI publishes each
release; the repo's README, "Releasing"). In the app's folder:

```sh
vp add void-fbtee
vp exec void-fbtee init --locales ar-EG,th-TH
vp dev      # prepares and translates as you work
vp build    # fails on anything untranslated
```

`init` adds only what's missing, so it's safe to run again. It installs what it adds, with the
app's own package manager, and says who will translate as you work on this machine. Once the app has a home page under
`pages/[lang]/`, it also writes Void's not-found and error pages in the page's language
(`pages/_not-found.tsx`, `pages/_error.tsx`), unless the app has its own; and a sitemap with
every page in every language (`routes/sitemap.xml.ts`). `init` is void-fbtee's only command;
everything after it is Vite+'s own (below).

Then give it the site's own address, so every copy of the site (the dev server, a Worker Preview)
names the real one in each page's canonical, hreflang and `og:url`, and in the sitemap
(`siteOrigin()` from `void-fbtee/server`). In the app's `vite.config.ts`:

```ts
voidFbtee({ sourceLocale, locales, site: "https://example.com" });
```

`https://`, the host alone (no path, no trailing slash). Without it, each page uses the address
its request came to. With it, a copy at another address answers `X-Robots-Tag: noindex`, so it
stays out of search results. `vp exec void-fbtee init --site https://example.com` adds it. A change to `voidFbtee()`'s options needs the dev server restarted: Vite reads
the plugin once, when it starts.

Translating as you work can be left to you: `voidFbtee({ translate: false })` turns both
translators off, and `{ translate: { gemini: false } }` or `{ translate: { claude: false } }` one of
them. `vp dev` still reports what's left, and `vp build` still stops on it. Under CI and in tests
(Vitest) it never translates.

`"/"` sends each visitor to their own language: the first of their browser's languages the app
has, matched by fbtee's own rule (`th` gets `th-TH`, `ar-SA` gets `ar-EG`), with a 302 that's never
cached. Nothing is remembered: no cookie, no setting. A visitor none of whose languages the app has,
or a crawler that names none, gets the fallback language: the source language, or
`voidFbtee({ fallbackLocale: "en-US" })`. Every other address keeps its language, for everyone. An
app with its own page at `"/"` sets `voidFbtee({ redirectHome: false })`.

`<LanguagePicker />` (`void-fbtee/react`) is for someone choosing another language on purpose:
one control however many languages the app has. Closed, it names the page's language in itself;
open, the visitor's own languages first, then every language the app has (from `voidFbtee({
locales })`, none written anywhere else), named in itself and in the page's language, with a
search box. Each is a plain link to this page in that language, so nothing is remembered. It has
no look of its own: give each part a class (`classNames={{ summary: "…", item: "…" }}`), and style
its states from its attributes (`open`, `data-current`, `data-yours`, `data-yours-elsewhere`). Its
words are the app's, in fbtee: `label`, `placeholder`, `yours`. The example's header
(`apps/example/src/shell/SiteHeader.tsx`) shows one.

Labels used on several pages can be fbtee's common strings: each described once, in
`voidFbtee({ common })` (text → description), then written `<fbt common>Events</fbt>`. The example
keeps them in `i18n/common_strings.json`:

```ts
import common from "./i18n/common_strings.json" with { type: "json" };
voidFbtee({ sourceLocale, locales, common });
```

Link previews (WhatsApp, Facebook, LinkedIn, Slack, X) need each page's title and description,
which void-fbtee gives them in the page's language (`pageHead` from `void-fbtee/head` in a page's
`head()`; the frontmatter's on a markdown page), and the site's own tags, which are the app's. Put
those in `void.config.ts`'s `head`, written with `meta` from `void-fbtee/head` (unhead's readable
keys):

```ts
meta: [
  ...meta({
    ogSiteName: "Acme",
    ogType: "website",
    ogImage: { url: "https://example.com/og-1.png", width: 1200, height: 630, type: "image/png", alt: "Acme" },
    twitterCard: "summary_large_image",
  }),
],
```

The picture's address in full, and a new name for a new picture: sharing apps keep one a long time. An
installed app's name and description can be translated in one manifest (`*_localized`, Chrome and
Edge 148); the example's `routes/manifest.webmanifest.ts` builds it from the catalogs with
`inEveryLocale` from `void-fbtee/server`. Its start page is `/`, which goes to the source
language: the browser picks the manifest's text by the reader's language, not a start page.

Structured data for search engines (schema.org JSON-LD) goes in a page's `head()` through
`jsonLd` from `void-fbtee/head`, which escapes it so text a visitor typed can't end the script:
`script: [jsonLd({ "@context": "https://schema.org", "@type": "Event", name, startDate, … })]`.

## Using it

How to write translated strings, format dates and numbers in components, build typed links, give
pages translated titles, translate in code with no page (`inLocale`), send emails and print PDFs in each
reader's language and translate markdown pages: `skills/void-fbtee/SKILL.md` in this package.
It's written for coding agents, and `init` links it where yours finds it.

Emails take nothing more from void-fbtee than a page does: `inLocale` writes one in its
recipient's language and `langAttrs` marks text in another. What's particular to email is HTML that
mail apps rewrite: Gmail drops `<html>` and `<body>`, so the language and direction go on the
content too. The SKILL's "Translated emails" lists it all; the example's Emails docs page shows its
own emails with the code that does each.

fbtee itself is used as its README describes; void-fbtee adds only what a Void app needs around it.
Which piece does what (the example's Strings page shows each in three languages):

- a sentence: `<fbt>` in components, `fbs` for a plain string;
- a count: `<fbt:plural>`, with every plural form the language has;
- a list in a sentence: `<fbt:list>`;
- a choice from a fixed set: `<fbt:enum>`;
- a person and their gender: `<fbt:name>`, `<fbt:pronoun>`;
- the same value twice: `<fbt:same-param>`;
- part of a page in another language, or worded by the reader's gender: void-fbtee's
  `<InLanguage locale gender>`, on fbtee's scoped runtimes.

fbtee's own language switching (`setLocale`) isn't used: each language has its own address.

PDFs too (a ticket, an invoice): `inLocale` writes the page of HTML in its reader's language, and
Cloudflare Browser Run prints it, so Arabic and Thai come out right with only the system's fonts.
The SKILL's "Translated PDFs" lists what it takes; the example's PDFs docs page shows a ticket.

## Built into Vite+

Translation isn't a separate tool to remember: it's part of each command a Vite+ app already
runs, the same on a developer's machine as in CI. There are no i18n scripts.

| Command    | What it does about translations                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp dev`   | As it starts and on each save, adds new strings to every catalog, with each language's plural and gender forms, marked new, and translates what's new straight after, strings and markdown pages: with Void's AI when the app uses `void/ai` (`void-fbtee/ai`, in the app's own Worker); Claude Code (a `claude` on your machine, signed in) translates what's left and reviews what Void's AI wrote. Reports what's left. |
| `vp build` | Fails on anything left: an untranslated string or page, a page older than its original, a setup problem. So `void deploy`, and CI, can't ship one.                                                                                                                                                                                                                                                                         |
| `vp check` | Lints with fbtee's strict rules: text nobody wrapped for translation is an error.                                                                                                                                                                                                                                                                                                                                          |
| CI         | The same commands on every push: `vp check`, `vp build`, then the deploy.                                                                                                                                                                                                                                                                                                                                                  |

**What people post.** Run `vp exec void-fbtee gen translations events title description` and
void-fbtee translates every row of `events` into the app's languages, and again when a row is
changed (call `content.translateSoon(events, id, { changed: true })` when it is). It writes
ordinary files at Void's own places. `db/schema/events_translations.ts` is kept by void-fbtee, as
Void keeps Better Auth's tables: the list of fields in it is the app's, and the rest (plain
Drizzle, its fields typed from the table's own columns) is rewritten by `vp dev` to the package's
current table, and checked by `vp build`. `src/content.ts` (the app's schema, database and queue
handed to the package), `queues/translate.ts` and `crons/translations.ts` are the app's, written
once; `vp build` fails while one is missing. Every function is typed from the app's schema: a
table with no translations, or a field it doesn't translate, doesn't compile. Then
`vp exec void db generate` makes the table's migration. The SKILL's "What
people post" has the rest.

**What translating costs, and where the text goes.** Void's AI translates with Google's Gemini 4
Hydrogen through Cloudflare's AI Gateway, one string, post or page a request, paid from the
Cloudflare account's AI Gateway credits (Unified Billing): US$1.50 a million tokens in and US$7.50
out, its thinking paid as out, so about US$0.001–0.01 a string per language (the example: 361
strings, about US$1–2 a language; measured 2026-11-18). Each translation keeps what it cost
(`usage`: in the catalog entry, the page's frontmatter, the post's row). The text goes to Google:
don't send what mustn't leave you. When the credits are used up (HTTP 402) or a
spend limit set on the gateway is reached (429), `vp dev` says so once and stops asking; what's
left stays new for Claude Code or the next save. A spend limit (Cloudflare's AI Gateway docs,
"Spend limits") caps what dev and the live site can spend together.

Words a product uses everywhere (its menu, its own terms) go once in `i18n/common_strings.json`,
fbtee's common strings, with their description, and are written `<fbt common>Seats</fbt>` or
`fbs.c("Seats")`: one translation each, the same on every page.

## In Vite DevTools

With [Vite DevTools](https://devtools.vite.dev) in the app (`@vitejs/devtools` 0.8 as a dev
dependency, and in `vite.config.ts` `devtools: { apply: "serve" }`, so it runs in `vp dev` and not
in builds, whose output Void deploys), void-fbtee has its own panel: each language's translated and
untranslated strings, fbtee's own, what's waiting for review and its catalog's size; what `vp build`
would stop on; the translated pages; and who translates (Gemini, Claude Code) and why one doesn't.
Its buttons, also in DevTools' command palette, prepare, translate and check now. Everything
void-fbtee says, Claude Code's work included, is in a DevTools terminal too, and DevTools shows a
message when something would stop the build. Without DevTools nothing of this loads.

## Bundling

`vp build` is Vite's, on Rolldown. Rolldown's own plugins work with it, each tried on a new
`void init` app (Rolldown 1.2.18, 2026-11-20): `replacePlugin` replaces in the pages void-fbtee
compiles; `esmExternalRequirePlugin` has nothing of void-fbtee's to change (none of what runs in the
Worker or the browser uses `require`); `bundleAnalyzerPlugin` lists each language's catalog on its
own (`virtual:void-fbtee/catalog/th-TH`). Its report goes in the browser's output, which Void deploys
with the site: name it outside that, or turn it on only for a build you look at.

## Systems

fbtee's compiler is native code, installed already built for your system by your package
manager. fbtee builds it for macOS (Apple Silicon and Intel), Windows (x64 and ARM) and Linux
(x64 and ARM, glibc and musl).

On Vite+, `init` adds fbtee's lint rules (`@nkzw/eslint-plugin-fbtee`, its strict set). Besides
checking each string's description, they warn of text no one wrapped for translation (`vp lint`
lists it, a new app's starter page included); names that stay as they are (the app's, products')
go in `no-untranslated-strings`'s `ignoredWords`. They use typescript-eslint,
which doesn't support TypeScript 7 yet ([typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518)),
so your package manager warns of an unmet `typescript` peer. The rules work. With pnpm's
`strictPeerDependencies`, allow it in `pnpm-workspace.yaml` (in the
`peerDependencyRules.allowedVersions` that `void init` writes there on Vite+):

```yaml
peerDependencyRules:
  allowedVersions:
    "@typescript-eslint/utils>typescript": "7"
    "@typescript-eslint/typescript-estree>typescript": "7"
    "@typescript-eslint/project-service>typescript": "7"
    "@typescript-eslint/tsconfig-utils>typescript": "7"
```

## License

MIT
