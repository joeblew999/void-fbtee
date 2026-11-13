// The app's strings and catalogs, in-process with fbtee's own compiler. Shared by the Vite
// plugin (runtime catalogs, missing-translation report) and the void-fbtee command (prepare,
// check), so they all count "missing" the same way.
//
// - Strings are collected from the app's source plus fbtee's built-in strings
//   (fbtee/Strings.json), as fbtee's own CLI does by default (--include-default-strings).
// - "Missing" is fbtee's own rule: after prepare-translations, an entry still marked
//   "status": "new", or with no translations (what `fbtee translate --strict` fails on).
import { createRequire } from "node:module";
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  collectBatchSync,
  prepareTranslationsBatchSync,
  translateSync,
} from "@nkzw/fbtee-compiler";
import type { LocaleConfig } from "./locales";
import { addPluralForms, pluralSlots } from "./plurals";

// Where an app's strings can be: every folder of code in Void's project structure (Void's docs,
// reference/structure.md: pages, routes, middleware, crons, queues, email, durable-objects, src),
// plus components/ and lib/, which apps commonly add. A string used only in a scheduled job or an
// email is collected like any other, so `void-fbtee check` reports it untranslated.
export const DEFAULT_SRC = [
  "pages/**/*.{ts,tsx,js,jsx}",
  "routes/**/*.{ts,tsx,js,jsx}",
  "middleware/**/*.{ts,tsx,js,jsx}",
  "crons/**/*.{ts,tsx,js,jsx}",
  "queues/**/*.{ts,tsx,js,jsx}",
  "email/**/*.{ts,tsx,js,jsx}",
  "durable-objects/**/*.{ts,tsx,js,jsx}",
  "src/**/*.{ts,tsx,js,jsx}",
  "components/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}",
];
export const DEFAULT_TRANSLATIONS = "i18n/translations";

export interface Project {
  root: string;
  config: LocaleConfig;
  /** Folder of editable catalogs, relative to root. */
  translations: string;
  src: string[];
}

interface Phrase {
  hashToLeaf?: Record<string, { text: string; desc: string }>;
}
interface Entry {
  status?: string;
  translations?: unknown[];
}
interface Catalog {
  "fb-locale"?: string;
  translations: Record<string, Entry>;
}

const LANGS = ["tsx", "ts", "jsx", "js"] as const;
const langOf = (file: string) => LANGS.find((l) => file.endsWith("." + l)) ?? "js";

/** fbtee's built-in strings, resolved from the app's own fbtee. */
function builtinPhrases(root: string): Phrase[] {
  const require = createRequire(join(root, "package.json"));
  return JSON.parse(readFileSync(require.resolve("fbtee/Strings.json"), "utf8")).phrases;
}

export const catalogFile = (p: Project, locale: string) =>
  join(p.root, p.translations, `${locale}.json`);

/** The app's source files that may hold <fbt> or fbs. */
export function sourceFiles(p: Project): string[] {
  return globSync(p.src, { cwd: p.root, exclude: (f) => f.includes("node_modules") })
    .map((f) => join(p.root, f))
    .filter((f) => {
      const text = readFileSync(f, "utf8");
      return text.includes("fbt") || text.includes("fbs");
    });
}

export interface Collected {
  /** fbtee's collected strings: the app's, then fbtee's built-ins. */
  phrases: Phrase[];
  /** Hashes of fbtee's built-in strings, reported apart from the app's own. */
  builtinHashes: Set<string>;
  /** Source text per hash, for messages about missing translations. */
  texts: Record<string, string>;
  files: string[];
}

let cache: { key: string; value: Collected } | undefined;

/**
 * Collects every string once. Each file is parsed by its own extension, as fbtee's Vite plugin
 * does (a .ts file with an old-style `<T>value` cast would be misread as JSX under "tsx").
 * Cached until a source file changes, so one build collects once, not per locale and environment.
 */
export function collect(p: Project): Collected {
  const files = sourceFiles(p);
  const key = files.map((f) => `${f}:${statSync(f).mtimeMs}`).join("|");
  if (cache?.key === key) return cache.value;
  const phrases: Phrase[] = [];
  for (const lang of LANGS) {
    const batch = files.filter((f) => langOf(f) === lang);
    if (!batch.length) continue;
    const out = collectBatchSync(
      batch.map((f) => ({ filename: relative(p.root, f), sourceText: readFileSync(f, "utf8") })),
      { lang, collectPackager: "text" },
    );
    if (out.errors.length)
      throw new Error(
        `void-fbtee: collecting strings failed: ${out.errors.map((e) => e.message).join("; ")}`,
      );
    phrases.push(...(JSON.parse(out.output ?? "{}").phrases ?? []));
  }
  const builtins = builtinPhrases(p.root);
  const builtinHashes = new Set(builtins.flatMap((ph) => Object.keys(ph.hashToLeaf ?? {})));
  const all = [...phrases, ...builtins];
  const texts: Record<string, string> = {};
  for (const ph of all)
    for (const [h, leaf] of Object.entries(ph.hashToLeaf ?? {})) texts[h] = leaf.text;
  const value = { phrases: all, builtinHashes, texts, files };
  cache = { key, value };
  return value;
}

const translatedLocales = (p: Project) =>
  p.config.locales.map((l) => l.locale).filter((l) => l !== p.config.sourceLocale);

/**
 * What `void-fbtee prepare` writes: every translated locale's catalog after fbtee's own
 * prepare-translations (new strings marked "new", finished ones kept, stale ones removed), plus a
 * line for each plural form the locale needs (plurals.ts).
 */
export function prepared(p: Project): { locale: string; json: string; existed: boolean }[] {
  const { phrases } = collect(p);
  const locales = translatedLocales(p);
  const inputs = locales.map((locale) => {
    const file = catalogFile(p, locale);
    return existsSync(file) ? { locale, existingJson: readFileSync(file, "utf8") } : { locale };
  });
  const out = prepareTranslationsBatchSync(JSON.stringify({ phrases }), inputs);
  // fbtee's prepare leaves plural forms out; add a line for each form the locale needs.
  const slots = pluralSlots(phrases);
  return out.map((json, i) => ({
    locale: locales[i]!,
    json: addPluralForms(json, slots, locales[i]!),
    existed: !!inputs[i]!.existingJson,
  }));
}

export interface LocaleMissing {
  locale: string;
  /** The app's own untranslated strings, as source text. */
  app: string[];
  /** fbtee's built-in strings still untranslated. */
  builtin: number;
  /** No catalog file yet. */
  noCatalog: boolean;
}

/** Untranslated strings per locale, by fbtee's own rule. */
export function missing(p: Project): LocaleMissing[] {
  const { builtinHashes, texts } = collect(p);
  return prepared(p).map(({ locale, json, existed }) => {
    const entries = Object.entries((JSON.parse(json) as Catalog).translations);
    const open = entries.filter(([, e]) => e.status === "new" || !e.translations?.length);
    return {
      locale,
      app: open.filter(([h]) => !builtinHashes.has(h)).map(([h]) => texts[h] ?? h),
      builtin: open.filter(([h]) => builtinHashes.has(h)).length,
      noCatalog: !existed,
    };
  });
}

/** One line per locale, for the dev server and the build. */
export function formatMissing(report: LocaleMissing[]): string | undefined {
  const open = report.filter((r) => r.app.length || r.builtin);
  if (!open.length) return;
  return open
    .map((r) => {
      const names = r.app.slice(0, 5).map((t) => JSON.stringify(t));
      if (r.app.length > 5) names.push("…");
      const parts = [
        r.app.length ? `${r.app.length} untranslated (${names.join(", ")})` : "",
        r.builtin ? `${r.builtin} of fbtee's built-in strings` : "",
      ].filter(Boolean);
      return `  ${r.locale}: ${parts.join(", plus ")}${r.noCatalog ? "; no catalog yet" : ""}`;
    })
    .join("\n");
}

/**
 * Each string's source text by fbtee's runtime hash (the key the browser reports in
 * onMissingTranslation, not the catalog hash). Made with fbtee's own translateSync: every string
 * gets a marker translation, and the runtime table then maps runtime hash -> marker.
 */
export function runtimeTexts(p: Project): Record<string, string> {
  const { phrases, texts } = collect(p);
  const MARK = "\u0000";
  const translations = Object.fromEntries(
    Object.keys(texts).map((h) => [
      h,
      {
        status: "translated",
        tokens: [],
        types: [],
        translations: [{ translation: MARK + h, variations: {} }],
      },
    ]),
  );
  const group = { "fb-locale": "zz-ZZ", translations };
  const table = JSON.parse(
    translateSync(JSON.stringify({ phrases, translationGroups: [group] }), true),
  );
  // A plural or gender string is a nested table; any leaf names the string.
  const firstMark = (v: unknown): string | undefined =>
    typeof v === "string"
      ? v.startsWith(MARK)
        ? v.slice(1)
        : undefined
      : v && typeof v === "object"
        ? Object.values(v).map(firstMark).find(Boolean)
        : undefined;
  const out: Record<string, string> = {};
  for (const [runtimeHash, value] of Object.entries(table["zz-ZZ"] ?? {})) {
    const hash = firstMark(value);
    if (hash) out[runtimeHash] = texts[hash] ?? hash;
  }
  return out;
}

/** fbtee's runtime table for one locale, from its editable catalog. Empty if there's none. */
export function runtimeCatalog(p: Project, locale: string): Record<string, unknown> {
  const file = catalogFile(p, locale);
  if (!existsSync(file)) return {};
  const { phrases } = collect(p);
  const group = JSON.parse(readFileSync(file, "utf8"));
  const table = JSON.parse(
    translateSync(JSON.stringify({ phrases, translationGroups: [group] }), true),
  );
  return table[locale] ?? {};
}
