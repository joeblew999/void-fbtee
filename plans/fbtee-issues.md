# plans/fbtee-issues.md: two issues for nkzw-tech/fbtee

Status: drafted 2026-11-14, not filed: they wait for the user's OK. Moved here from the language
plans, now done and deleted (git keeps them). When fbtee exports `negotiateLocale`,
`packages/void-fbtee/src/negotiate.ts`'s copy goes and fbtee's is called.

Two, one per subject, filed only with the user's OK.

### 1. Locale matching: regional variants, and using it on a server

Title: Locale matching for sites with several variants of a language, and on the server

> void-fbtee (https://github.com/joeblew999/void-fbtee) uses fbtee in Void apps that will have
> many languages, and wants one rule for "which language" across the app: fbtee's.
>
> **Regional variants.** With one variant per language, fbtee's matching gives the expected answer.
> With several, it picks the region `Intl.Locale` infers rather than the nearer variant CLDR's
> parent locales give (cldr-core 49.0.0, `parentLocales`):
>
> | Visitor | Site has          | fbtee 6.0.0 | CLDR parent               |
> | ------- | ----------------- | ----------- | ------------------------- |
> | `en-AU` | `en-US`, `en-GB`  | `en-US`     | `en-GB` (shared `en-001`) |
> | `es-MX` | `es-ES`, `es-419` | `es-ES`     | `es-419`                  |
> | `pt-AO` | `pt-BR`, `pt-PT`  | `pt-BR`     | `pt-PT`                   |
>
> It's your documented rule ("preferring the region inferred by `Intl.Locale`", README "Locale
> Matching and Fallback"). Would CLDR's parents be welcome, as the rule or an option? The same
> answer matters in the browser (`clientLocales: navigator.languages`).
>
> **On the server.** We choose the language for a request from `Accept-Language` in middleware.
> `negotiateLocale` isn't exported, and `setupLocaleContext` also calls `setupFbtee`, which isn't
> safe per request. Could `negotiateLocale` (and the locale-chain helpers it uses) be exported?
> Until then void-fbtee carries a copy, with a test comparing it to
> `setupLocaleContext(...).getLocale()`.
>
> Exported as it is, it would need one change for servers: `getLocaleHierarchy` keeps every tag it
> has seen in a module-level `Map` (`const hierarchies`, `lib/index-core-44-4LnRZ.mjs`), never
> cleared. In a browser that's a handful of tags. On a server fed every visitor's `Accept-Language`,
> anyone can send new tags until the process runs out of memory. "Each request has its own hooks and
> caches" (README, "Server Rendering") doesn't cover it, since the map is shared by the process. Our
> copy has no cache (it's cheap to work out each time); a size cap would do too.

### 2. Two things seen in Arabic

Title: Arabic: the exactly-one form's digit, and the list's middle separator

> Seen in https://github.com/joeblew999/void-fbtee, with fbtee 6.0.0:
>
> - With `sourceLocale: "ar-EG"` and no catalog for it, the inline exactly-one form of
>   `fbt.plural("ليلة", count, { many: "ليالٍ", showCount: "yes" })` renders a Latin `1`
>   ("حجزت 1 ليلة"), where other counts come out in Arabic-Indic digits ("حجزت ٢ ليالٍ"). Should the
>   exactly-one form format its `1` like the other counts?
> - `list()` joins every item but the last with one string, `{previous items}, {following items}`,
>   for "and", "or" and plain lists alike. CLDR's Arabic "and" list is `A وB وC` (what
>   `Intl.ListFormat("ar-EG")` prints), but translating that string as `و` makes the "or" list
>   `A وB أو C`. Would a separate middle string per conjunction be welcome?
