// What `void-fbtee check` checks, as plain functions. Each problem is one
// line a person can act on.
import { createHash } from "node:crypto";
import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { missing, sourceFiles, type Project } from "./catalogs";

/** Frontmatter key a translated markdown page records its original's hash in. */
export const TRANSLATED_FROM = "translatedFrom";

/**
 * Hash of a markdown page for "is this translation out of date": the whole file with its own
 * `translatedFrom:` line removed and all whitespace collapsed, so formatting (which rewrites
 * blank lines in frontmatter) never makes a translation look stale. First 12 hex of SHA-256.
 */
export function markdownHash(text: string): string {
  const normalised = text
    .replace(new RegExp(`^${TRANSLATED_FROM}:.*$`, "m"), "")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalised).digest("hex").slice(0, 12);
}

export const recordedHash = (text: string) =>
  text.match(new RegExp(`^${TRANSLATED_FROM}:\\s*"?([0-9a-f]+)"?\\s*$`, "m"))?.[1];

export interface MarkdownPage {
  /** Path under the source locale's folder, e.g. blog/hello.md. */
  path: string;
  locale: string;
  /** Where the translation is, or should be. */
  file: string;
  /** The original, under the source locale's folder. */
  original: string;
  state: "ok" | "missing" | "stale" | "unrecorded";
}

/** Every markdown page in the source locale's folder, per other locale. */
export function markdownPages(p: Project): MarkdownPage[] {
  const pages = join(p.root, "pages");
  const source = p.config.locales.find((l) => l.locale === p.config.sourceLocale)!;
  const sourceDir = join(pages, source.segment);
  if (!existsSync(sourceDir)) return [];
  const files = globSync("**/*.md", { cwd: sourceDir });
  return p.config.locales
    .filter((l) => l.locale !== p.config.sourceLocale)
    .flatMap((l) =>
      files.map((path): MarkdownPage => {
        const file = join(pages, l.segment, path);
        const original = join(sourceDir, path);
        if (!existsSync(file)) return { path, locale: l.locale, file, original, state: "missing" };
        const recorded = recordedHash(readFileSync(file, "utf8"));
        const current = markdownHash(readFileSync(original, "utf8"));
        const state = !recorded ? "unrecorded" : recorded === current ? "ok" : "stale";
        return { path, locale: l.locale, file, original, state };
      }),
    );
}

/**
 * What a translated copy must keep exactly as the original has it: the `<script>` block and every
 * component tag (`<Fmt num="1234567.891" />`), props and all, whitespace collapsed.
 */
export function keptParts(text: string): string[] {
  const squash = (s: string) => s.replace(/\s+/g, " ").trim();
  const script = text.match(/<script\b[\s\S]*?<\/script>/)?.[0];
  const body = script ? text.replace(script, "") : text;
  const tags = [...body.matchAll(/<[A-Z][\w.]*\b[^>]*>/g)].map((m) => squash(m[0]));
  return [...(script ? [squash(script)] : []), ...tags].sort();
}

/** The parts the copy lacks and the ones it has that the original doesn't, as one line. */
function partsDiffer(original: string, copy: string): string | undefined {
  const want = keptParts(original);
  const have = keptParts(copy);
  const lacks = want.filter((x) => !have.includes(x));
  const extra = have.filter((x) => !want.includes(x));
  if (!lacks.length && !extra.length) return undefined;
  return [
    lacks.length && `lacks ${lacks.join(", ")}`,
    extra.length && `has ${extra.join(", ")} that the original doesn't`,
  ]
    .filter(Boolean)
    .join("; ");
}

const firstFile = (dir: string, names: string[]) =>
  names.map((n) => join(dir, n)).find((f) => existsSync(f));

/** Problems, one line each. Empty when everything is in order. */
export function check(p: Project): string[] {
  const problems: string[] = [];
  const rel = (f: string) => relative(p.root, f);

  // Setup (what `void-fbtee init` writes).
  const middlewareDir = join(p.root, "middleware");
  const hasMiddleware =
    existsSync(middlewareDir) &&
    readdirSync(middlewareDir).some((f) =>
      readFileSync(join(middlewareDir, f), "utf8").includes("void-fbtee/middleware"),
    );
  if (!hasMiddleware)
    problems.push(
      `setup: no middleware re-exports "void-fbtee/middleware" (middleware/99.i18n.ts)`,
    );
  const layout = firstFile(join(p.root, "pages"), ["layout.tsx", "layout.jsx"]);
  if (!layout || !readFileSync(layout, "utf8").includes("I18nProvider"))
    problems.push(`setup: the root layout (pages/layout.tsx) doesn't wrap pages in <I18nProvider>`);
  const voidConfig = firstFile(p.root, ["void.config.ts", "void.config.mts", "void.config.js"]);
  const flag = /compatibility_flags\s*:\s*\[[^\]]*["']temporal["']/;
  const voidConfigText = voidConfig ? readFileSync(voidConfig, "utf8") : "";
  if (!flag.test(voidConfigText))
    problems.push(
      `setup: Cloudflare's "temporal" flag is missing (void.config.ts: worker.compatibility_flags)`,
    );
  // "/" goes to the source language, by Void's own redirects, permanently.
  const source = p.config.locales.find((l) => l.locale === p.config.sourceLocale)!.segment;
  const home = new RegExp(
    `["']/["']\\s*:\\s*\\{[^}]*to\\s*:\\s*["']/${source}["'][^}]*status\\s*:\\s*301`,
  );
  if (!home.test(voidConfigText))
    problems.push(
      `setup: "/" doesn't redirect to /${source} (void.config.ts: routing.redirects, "/": { to: "/${source}", status: 301 })`,
    );

  // fbtee#83: plurals with showCount="no" lose their count token. (Vite+ apps also get this as a
  // lint rule; plain-Vite apps only here.)
  for (const f of sourceFiles(p)) {
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/showCount\s*=\s*["']no["']/.test(line))
          problems.push(`strings: ${rel(f)}:${i + 1}: showCount="no" drops the count (fbtee#83)`);
      });
  }

  // Untranslated strings, by fbtee's own rule (same count as the plugin's report).
  for (const r of missing(p)) {
    if (r.noCatalog) problems.push(`strings: ${r.locale}: no catalog yet`);
    for (const text of r.app)
      problems.push(`strings: ${r.locale}: untranslated ${JSON.stringify(text)}`);
    if (r.builtin)
      problems.push(`strings: ${r.locale}: ${r.builtin} of fbtee's built-in strings untranslated`);
  }

  // Markdown pages: every page in every locale, translated from the current original.
  for (const page of markdownPages(p)) {
    const what = {
      ok: "",
      missing: "not translated yet",
      stale: "out of date (the original changed)",
      unrecorded: `doesn't record which original it was translated from (${TRANSLATED_FROM})`,
    }[page.state];
    if (what) problems.push(`pages: ${page.locale}: ${rel(page.file)}: ${what}`);
    // Components and the script block are data, the same in every copy (an out-of-date copy is
    // reported above, and is redone from the original anyway).
    if (page.state === "ok" || page.state === "unrecorded") {
      const differ = partsDiffer(
        readFileSync(page.original, "utf8"),
        readFileSync(page.file, "utf8"),
      );
      if (differ)
        problems.push(`pages: ${page.locale}: ${rel(page.file)}: components differ: ${differ}`);
    }
  }
  return problems;
}
