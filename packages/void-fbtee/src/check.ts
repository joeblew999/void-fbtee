// What `void-fbtee check` checks, as plain functions. Each problem is one
// line a person can act on.
import { createHash } from "node:crypto";
import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { missing, type Project } from "./catalogs";

/** Frontmatter key a translated markdown page records its original's hash in. */
export const TRANSLATED_FROM = "translatedFrom";

/** The whole `translatedFrom:` line of a page's frontmatter. */
export const TRANSLATED_FROM_LINE = new RegExp(`^${TRANSLATED_FROM}:.*$`, "m");

/**
 * A markdown page's frontmatter: the `---` block at its top, after the `<script>` block a page
 * with islands starts with (@void/md's order). `start` and `end` are where the block is, `close`
 * where its closing `---` begins (to add a line before it), `yaml` what's between. Undefined when
 * the page has none. The one reader of frontmatter here: `check`, `translate` and `stamp` use it.
 */
export function frontmatter(
  text: string,
): { start: number; end: number; close: number; yaml: string } | undefined {
  const start = /^\s*(?:<script\b[\s\S]*?<\/script>\s*)?/.exec(text)![0].length;
  const block = /^---\r?\n([\s\S]*?)\r?\n(---)[ \t]*(?=\r?\n|$)/.exec(text.slice(start));
  if (!block) return undefined;
  const end = start + block[0].length;
  return { start, end, close: start + block[0].lastIndexOf("---"), yaml: block[1]! };
}

/**
 * Hash of a markdown page for "is this translation out of date": the whole file with its own
 * `translatedFrom:` line removed and all whitespace collapsed, so formatting (which rewrites
 * blank lines in frontmatter) never makes a translation look stale. First 12 hex of SHA-256.
 */
export function markdownHash(text: string): string {
  const normalised = text.replace(TRANSLATED_FROM_LINE, "").replace(/\s+/g, " ").trim();
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
 * The frontmatter fields a translated copy must keep because its original has them: `title` and
 * `description` are the page's <title>, its search result text and its link preview (Void reads
 * them, and void-fbtee's middleware gives them to og:title and og:description). A copy without
 * one has none of those in its language. Returns the missing ones.
 */
export function missingHead(original: string, copy: string): string[] {
  const fields = (text: string) => {
    const yaml = frontmatter(text)?.yaml ?? "";
    return new Set(
      [...yaml.matchAll(/^(title|description):[ \t]*(\S.*)$/gm)].map(([, key]) => key!),
    );
  };
  const has = fields(copy);
  return [...fields(original)].filter((key) => !has.has(key));
}

/** A markdown page's `<script>` block, frontmatter and fenced code blocks, split from its text. */
function splitPage(text: string) {
  const fm = frontmatter(text);
  const rest = fm ? text.slice(0, fm.start) + text.slice(fm.end) : text;
  const script = rest.match(/<script\b[\s\S]*?<\/script>/)?.[0];
  const body = script ? rest.replace(script, "") : rest;
  const fence = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
  const code = [...body.matchAll(fence)].map((m) => m[0]);
  return { script, code, text: body.replace(fence, "") };
}

/**
 * What a translated copy must keep exactly as the original has it, whitespace collapsed: the
 * `<script>` block, every component tag (`<Fmt num="1234567.891" />`), props and all, the code
 * blocks, @void/md's markers (`::: tip`, `> [!NOTE]`, `[[toc]]`), attributes (`{#times}`),
 * footnote labels (`[^dst]`) and link targets. The rest is text to translate.
 */
export function keptParts(text: string): string[] {
  const squash = (s: string) => s.replace(/\s+/g, " ").trim();
  const page = splitPage(text);
  const all = (re: RegExp, as: (m: RegExpMatchArray) => string = (m) => m[0]) =>
    [...page.text.matchAll(re)].map(as);
  return [
    ...(page.script ? [page.script] : []),
    ...page.code,
    ...all(/<[A-Z][\w.]*\b[^>]*>/g),
    ...all(/^:::[ \t]*(\w+)/gm, (m) => `::: ${m[1]}`),
    ...all(/^>[ \t]*\[!(\w+)\]/gm, (m) => `> [!${m[1]!.toUpperCase()}]`),
    ...all(/\[\[toc\]\]/g),
    ...all(/\{[.#][^{}\n]*\}/g),
    ...all(/\[\^[^\]\s]+\]/g),
    ...all(/\]\(([^)\s]+)\)/g, (m) => `(${m[1]})`),
  ]
    .map(squash)
    .sort();
}

/**
 * The boxes and alerts (`::: tip`, `> [!NOTE]`) a page leaves without a title. @void/md shows
 * its own English default there ("TIP", "NOTE"), which no translation can change; the original
 * gives each one a title, and each copy translates it.
 */
export function untitled(text: string): string[] {
  const { text: body } = splitPage(text);
  return [
    ...[...body.matchAll(/^:::[ \t]*(tip|info|warning|danger|details)[ \t]*$/gm)].map(
      (m) => `::: ${m[1]}`,
    ),
    ...[...body.matchAll(/^>[ \t]*\[!(\w+)\][ \t]*$/gm)].map((m) => `> [!${m[1]!.toUpperCase()}]`),
  ];
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

  // Untranslated strings, by fbtee's own rule (same count as the plugin's report).
  for (const r of missing(p)) {
    if (r.noCatalog) problems.push(`strings: ${r.locale}: no catalog yet`);
    for (const text of r.app)
      problems.push(`strings: ${r.locale}: untranslated ${JSON.stringify(text)}`);
    if (r.builtin)
      problems.push(`strings: ${r.locale}: ${r.builtin} of fbtee's built-in strings untranslated`);
  }

  // Markdown pages: every page in every locale, translated from the current original.
  const pages = markdownPages(p);
  const untitledIn = (locale: string, file: string) => {
    for (const box of untitled(readFileSync(file, "utf8")))
      problems.push(
        `pages: ${locale}: ${rel(file)}: ${box} has no title, so it shows @void/md's English one: give it a title`,
      );
  };
  for (const original of new Set(pages.map((page) => page.original)))
    untitledIn(p.config.sourceLocale, original);
  for (const page of pages) {
    const what = {
      ok: "",
      missing: "not translated yet",
      stale: "out of date (the original changed)",
      unrecorded: `doesn't record which original it was translated from (${TRANSLATED_FROM})`,
    }[page.state];
    if (what) problems.push(`pages: ${page.locale}: ${rel(page.file)}: ${what}`);
    // What keptParts() lists is the same in every copy (an out-of-date copy is reported above,
    // and is redone from the original anyway).
    if (page.state === "ok" || page.state === "unrecorded") {
      const differ = partsDiffer(
        readFileSync(page.original, "utf8"),
        readFileSync(page.file, "utf8"),
      );
      if (differ)
        problems.push(
          `pages: ${page.locale}: ${rel(page.file)}: differs from the original where it must match: ${differ}`,
        );
    }
    if (page.state !== "missing") {
      untitledIn(page.locale, page.file);
      for (const key of missingHead(
        readFileSync(page.original, "utf8"),
        readFileSync(page.file, "utf8"),
      ))
        problems.push(
          `pages: ${page.locale}: ${rel(page.file)}: no ${key} in its frontmatter, though the original has one, so its search result and link preview have none: translate it`,
        );
    }
  }
  return problems;
}
