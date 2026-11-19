# plans/fbtee-issues.md: issues for nkzw-tech/fbtee

Status: drafted 2026-11-14, not filed: they wait for the user's OK. Moved here from the language
plans, now done and deleted (git keeps them). When fbtee exports `negotiateLocale`,
`packages/void-fbtee/src/negotiate.ts`'s copy goes and fbtee's is called.

One per subject, filed only with the user's OK. The third (2026-11-18) comes from checking every
place void-fbtee does fbtee's work against fbtee 6.0.0 itself (its README, CLI, exports and code).

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

### 3. Using fbtee for content that isn't in the code, and in a Worker

Title: An API for translations that don't come from source code (at runtime, in a Worker)

> void-fbtee translates Void apps (Cloudflare Workers). Besides the app's own `<fbt>` strings, an
> app has text people write (an event's title and description, stored in a database) that needs
> the same treatment: entries in the catalog format, translated, then shown in the reader's
> language. Today that can't go through fbtee, so we keep a second system beside it.
>
> What we'd use, each checked against fbtee 6.0.0:
>
> 1. **Render a registered translation by key.** Only the compiled form does it,
>    `fbt._(…, { hk })`; calling `fbt()` on text that wasn't compiled throws ("fbt must be compiled
>    with the fbtee compiler integration", `lib/index-core-*.mjs`). A documented call taking a key,
>    the slot values, counts and genders would let runtime text use fbtee's rendering.
> 2. **Keys an app makes itself.** The lookup (`getTranslatedInput`) finds a registered table by
>    `hk` with the locale chain and doesn't care how the key was made. Could that be documented as
>    supported for translations registered with `registerTranslations` / `mergeTranslations`?
> 3. **Preparing an entry in JS.** `prepare-translations` gives a plural or gender string one line
>    with `"variations": {}` and marks the token (`"types": [28]`, `[3]`); the lines each language
>    needs are left to the translator. We write those lines ourselves, copying the codes from
>    `IntlVariations` (16 zero, 4 one, 8 two, 20 few, 12 many, 24 other). Could prepare write them
>    (per locale, from `Intl.PluralRules`), with readable names alongside the codes, and be callable
>    from JS where the native compiler can't run?
> 4. **Compiling entries into the runtime table in JS**, what `translateSync` does, for the same reason.
> 5. **Checking tokens when compiling.** `fbtee translate` (and `--strict`) compiles a translation that
>    drops a placeholder: a Thai "Your time: {time}" translated without `{time}` compiled, exit 0.
>    It knows each message's tokens; a missing or unknown one could be reported.
> 6. **The locale chain exported** (`getAvailableLocaleChain`, with the natural parents `fr-CA` →
>    `fr`), so content outside fbtee falls back exactly as fbtee's own messages do.
> 7. **`fbtee/server` in Workers.** `exports["./server"]` gives `runWithFbtee` only under the `node`
>    condition; Cloudflare's `workerd` gets `index-core`. A `workerd` (or `worker`) condition would
>    let Workers use the per-request build without a bundler alias.
> 8. **Which key is stable.** Catalog files use one key (`sMtlR6Z8zMzZ6LalfCQsVQ==`), compiled code
>    another (`hk: "3uo8du"`). A note on which to rely on, for what, would help anyone building on top.
>
> Alternatives to 3 and 4: publishing the WebAssembly build the compiler's loader already looks
> for (`@nkzw/oxc-transform-fbtee-binding-wasm32-wasi` is a 404 on npm), or exporting the key
> function (`fbt_hash_key`, `src/translate.rs`).

What each changes here, when fbtee has it: 1, 2 and 3 replace void-fbtee's own runtime-content
lookup and `plurals.ts`'s copied codes; 5 replaces the placeholder check in `judge.ts`; 6 fixes
`fallbacksOf` (`runtime.ts`), which today skips natural parents for runtime content (a bug of
ours, to fix whether or not fbtee exports the chain); 7 removes the alias in `plugin.ts`.

Checked and not asked for (void-fbtee's code is needed, or it isn't fbtee's job): the catalog
workflow in our Vite plugin (fbtee's Vite plugin only compiles: `@nkzw/vite-plugin-fbtee` 6.0.0,
53 lines, options = `TransformOptions`); logging a missing string once across requests (fbtee
reports once per runtime, and each request is a runtime); text direction (`Intl`'s job); the
language picker and Void's links and forms in `react.tsx` (built on fbtee's own
`createLocaleContext` / `LocaleProvider`).

Found 2026-11-19 (`plans/checked-everywhere.md`), to add to the issue for the lint plugin if the
user agrees: `@nkzw/eslint-plugin-fbtee` 6.0.0 brings typescript-eslint 8.73.0, whose peer range
wants TypeScript `>=4.8.4 <6.1.0`, so `pnpm peers check` warns in any app on TypeScript 7
(`void init` apps get 7.0.2). The rules run under Oxlint here and work; the warning is the only
effect seen.
