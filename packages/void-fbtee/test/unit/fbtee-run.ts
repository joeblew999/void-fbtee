// fbtee's real compiler and runtime, for the tests: each step's output read and checked, so a test
// works with fbtee's own types rather than `any` (plans/checked-everywhere.md).
import {
  collectSync,
  prepareTranslationsBatchSync,
  transformSync,
  translateSync,
} from "@nkzw/fbtee-compiler";
import { createFbteeRuntime, type TranslationDictionary } from "fbtee";
import { readPhrases, runtimeTables } from "../../src/dev/catalogs";
import { isRecord, parseJson } from "../../src/guards";
import {
  addVariants,
  isPluralEntry,
  pluralSlots,
  type PluralEntry,
  type PluralPhrase,
} from "../../src/plurals";
import { got } from "./got";

export interface Prepared {
  "fb-locale": string;
  translations: Record<string, PluralEntry>;
}

/** The strings fbtee collects from `source`. */
export const phrasesFrom = (file: string, source: string): Array<PluralPhrase> =>
  readPhrases(
    parseJson(got(collectSync(file, source, { collectPackager: "text" }).output)),
    `fbtee's strings from ${file}`,
  );

/** A catalog's JSON, read and checked: each entry in fbtee's shape. */
export function readPrepared(json: string, what: string): Prepared {
  const value = parseJson(json);
  if (!isRecord(value) || typeof value["fb-locale"] !== "string" || !isRecord(value.translations)) {
    throw new Error(`${what} isn't a catalog`);
  }
  const translations: Record<string, PluralEntry> = {};
  for (const [hash, entry] of Object.entries(value.translations)) {
    if (!isPluralEntry(entry)) {
      throw new Error(`${what}: entry ${hash} isn't in fbtee's shape`);
    }
    translations[hash] = entry;
  }
  return { "fb-locale": value["fb-locale"], translations };
}

/** fbtee's prepared catalog for `locale`, with void-fbtee's lines added. */
export const prepare = (
  phrases: Array<PluralPhrase>,
  locale: string,
  existing?: object,
): Prepared =>
  readPrepared(
    addVariants(
      got(
        prepareTranslationsBatchSync(JSON.stringify({ phrases }), [
          existing ? { locale, existingJson: JSON.stringify(existing) } : { locale },
        ])[0],
      ),
      pluralSlots(phrases),
      locale,
    ),
    `the ${locale} catalog`,
  );

/** Each string's hash, by its source text. */
export const hashByText = (phrases: Array<PluralPhrase>): Record<string, string> =>
  Object.fromEntries(
    phrases.flatMap((p) => Object.entries(p.hashToLeaf ?? {}).map(([h, l]) => [l.text, h])),
  );

/** fbtee's runtime tables for `catalog`, compiled by its translateSync and checked. */
export const compiledTables = (
  phrases: Array<PluralPhrase>,
  catalog: Prepared,
): TranslationDictionary => ({
  [catalog["fb-locale"]]: runtimeTables(
    translateSync(JSON.stringify({ phrases, translationGroups: [catalog] }), true),
    catalog["fb-locale"],
  ),
});

type Fn = (...args: Array<unknown>) => unknown;
const isFn = (value: unknown): value is Fn => typeof value === "function";

/**
 * The functions `names` from `source`, compiled by fbtee and run with `fbt` (fbtee's runtime, or
 * its server one). Returns a lookup by name; each was checked to be a function, or the test stops.
 */
export function compiledWith<Name extends string>(
  file: string,
  source: string,
  names: ReadonlyArray<Name>,
  fbt: unknown,
): (name: Name) => Fn {
  const code = transformSync(file, source, { lang: "jsx" }).code.replace(/^import .*$/m, "");
  // Runs fbtee's compiled output for the strings in `source`.
  // oxlint-disable-next-line no-implied-eval -- the code is fbtee's own compiler output for the test's source
  const run = new Function("fbt", `${code}; return { ${names.join(", ")} };`);
  const out: unknown = Reflect.apply(run, undefined, [fbt]);
  const fns = new Map<Name, Fn>();
  for (const name of names) {
    const fn: unknown = isRecord(out) ? out[name] : undefined;
    if (!isFn(fn)) {
      throw new Error(`${file} has no function ${name}`);
    }
    fns.set(name, fn);
  }
  return (name) => got(fns.get(name), `function ${name}`);
}

/** As compiledWith, run against fbtee's runtime holding `catalog`. */
export function compiled<Name extends string>(
  file: string,
  source: string,
  names: ReadonlyArray<Name>,
  phrases: Array<PluralPhrase>,
  catalog: Prepared,
): (name: Name) => Fn {
  const locale = catalog["fb-locale"];
  const { fbt } = createFbteeRuntime({ locale, translations: compiledTables(phrases, catalog) });
  return compiledWith(file, source, names, fbt);
}
