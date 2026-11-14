# void-fbtee

i18n for [Void](https://void.cloud) apps: strings translated with
[fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, numbers and lists with
the platform's own `Intl`. An example app in three languages:
https://void-fbtee-example.gedw99.workers.dev

## What it is

A Void add-on, built the way Void's own `@void/md` and `@void/react` are: a Vite plugin
(`import { voidFbtee } from "void-fbtee/plugin"`) plus the parts a Void app uses at run time:
`void-fbtee/middleware` (each request's language), `void-fbtee/react` (components and forms),
`void-fbtee/routes` (links in the current language) and `void-fbtee/server` (cache clearing in
every language, and code with no page: a scheduled job, a queue consumer, an email). With Zod 4,
validation messages are in the page's language too. The Vite plugin works only in a Void app: it swaps
modules in Void's server environment (Cloudflare's own Temporal, fbtee's per-request build, Void's
own Hono), and the rest goes where Void looks for it (`middleware/99.i18n.ts`, `void.config.ts`),
which `void-fbtee init` sets up and `void-fbtee check` checks. React only, as fbtee is. It works
with Vite+ and with plain Vite, and with npm and pnpm.

The rule it follows is the one for dates in a database: data stays neutral (UTC instants with zone
names, plain numbers with currency codes), both to the browser and back, and is formatted once,
for the screen. The server formats a page's text and the browser keeps it (`<Formatted>`), because
each browser engine ships its own locale data and writes some values differently. What only the
browser knows, such as the reader's own time zone, the browser formats, once it knows it: the
server leaves that space empty rather than showing a stand-in.

## Add it to a Void app

It isn't on npm yet: an app installs a
[release](https://github.com/joeblew999/void-fbtee/releases) from its repo. In the app's
`package.json`:

```json
"dependencies": {
  "void-fbtee": "github:joeblew999/void-fbtee#v0.5.0&path:/packages/void-fbtee"
}
```

With pnpm, in its `pnpm-workspace.yaml` (pnpm only builds a git dependency you allow):

```yaml
allowBuilds:
  "void-fbtee@git+https://github.com/joeblew999/void-fbtee.git": true
```

Then, in the app's folder:

```sh
vp install
vp exec void-fbtee init --locales ar-EG,th-TH
vp install
vp run i18n:translate
```

`init` adds only what's missing, so it's safe to run again. Once the app has a home page under
`pages/[lang]/`, it also writes Void's not-found and error pages in the page's language
(`pages/_not-found.tsx`, `pages/_error.tsx`), unless the app has its own; and a sitemap with
every page in every language (`routes/sitemap.xml.ts`). `void-fbtee check` lists
anything untranslated or not set up, and `void-fbtee --help` lists the commands.

Then give it the site's own address, so every copy of the site (the dev server, a Worker Preview)
names the real one in each page's canonical, hreflang and `og:url`, and in the sitemap
(`siteOrigin()` from `void-fbtee/server`). In the app's `vite.config.ts`:

```ts
voidFbtee({ sourceLocale, locales, site: "https://example.com" });
```

`https://`, the host alone (no path, no trailing slash). Without it, each page uses the address
its request came to. With it, a copy at another address answers `X-Robots-Tag: noindex`, so it
stays out of search results. `void-fbtee init --site https://example.com` adds it. A change to `voidFbtee()`'s options needs the dev server restarted: Vite reads
the plugin once, when it starts.

`"/"` sends each visitor to their own language: the first of their browser's languages the app
has, matched by fbtee's own rule (`th` gets `th-TH`, `ar-SA` gets `ar-EG`), with a 302 that's never
cached. Nothing is remembered: no cookie, no setting. A visitor none of whose languages the app has,
or a crawler that names none, gets the fallback language: the source language, or
`voidFbtee({ fallbackLocale: "en-US" })`. Every other address keeps its language, for everyone. An
app with its own page at `"/"` sets `voidFbtee({ redirectHome: false })`.

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
