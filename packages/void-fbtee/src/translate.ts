// Translating, as `vp dev` does it (plugin.ts): the work goes to a coding agent, `claude -p` with
// void-fbtee's skill, allowed to read and edit files and nothing else, when `claude` is installed
// and signed in. The skill does the translating; this file only says
// what's missing, records each translated page's original, and checks the result.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogFile, collect, freshCatalog, missing, type Project } from "./catalogs";
import {
  frontmatter,
  keptParts,
  markdownHash,
  markdownPages,
  missingHead,
  TRANSLATED_FROM,
  TRANSLATED_FROM_LINE,
  type MarkdownPage,
} from "./check";
import { sourceOf } from "./locales";
import { sourceLanguageOf } from "./judge";
import { check } from "./check";
import { GEMINI, paymentAdvice, type Spent } from "./models";
import type { Entry } from "./gemini";

/** void-fbtee's own folder (dist/ is one level down), where skills/ ships. */
export const packageDir = () => dirname(dirname(fileURLToPath(import.meta.url)));

/** The skill as the app sees it: through node_modules if it's installed there. */
export function skillPath(root: string): string {
  const installed = join(root, "node_modules/void-fbtee/skills/void-fbtee/SKILL.md");
  if (existsSync(installed)) return relative(root, installed);
  return relative(root, join(packageDir(), "skills/void-fbtee/SKILL.md"));
}

export interface TranslateTask {
  /** The prompt for the agent; one line per file to work on. */
  prompt: string;
  /** Markdown pages to translate (their translatedFrom is recorded afterwards). */
  pages: MarkdownPage[];
}

/** What's left to translate, as a prompt for the agent. Undefined when nothing is. */
export function translateTask(p: Project): TranslateTask | undefined {
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");
  const dirOf = (locale: string) => p.config.locales.find((l) => l.locale === locale)?.dir;
  const strings = missing(p)
    .filter((m) => m.app.length || m.builtin)
    .map((m) => {
      const n = m.app.length + m.builtin;
      const rtl = dirOf(m.locale) === "rtl" ? ", right-to-left" : "";
      const own =
        m.locale === p.config.sourceLocale
          ? `, the source language's own plural forms: write each form in ${m.locale} itself`
          : "";
      return `- ${rel(catalogFile(p, m.locale))} (${m.locale}${rtl}${own}): ${n} entries with "status": "new"`;
    });
  const source = sourceOf(p.config);
  const pages = markdownPages(p).filter((page) => page.state !== "ok");
  const pageLines = pages.map((page) => {
    const from = rel(join(p.root, "pages", source.segment, page.path));
    const what = {
      missing: `new page: translate ${from}`,
      stale: `the original changed: update it to match ${from}, changing only what changed`,
      unrecorded: `already translated, not recorded: check it against ${from} and fix it only if it's wrong`,
    }[page.state as "missing" | "stale" | "unrecorded"];
    return `- ${rel(page.file)} (${page.locale}): ${what}`;
  });
  if (!strings.length && !pageLines.length) return;
  const prompt = [
    `Translate this Void app. First read ${skillPath(p.root)} (the void-fbtee skill) and follow it.`,
    "",
    ...(strings.length ? ["Strings (fbtee catalogs):", ...strings, ""] : []),
    ...(pageLines.length ? ["Markdown pages:", ...pageLines, ""] : []),
    `Edit only these files. When a markdown page is done (translated, or checked and right), set "${TRANSLATED_FROM}: ${DONE}" in its`,
    "frontmatter: the dev server replaces it with the version of the original it's from, then checks everything.",
    "Finish with one line per file: done, or what's left and why.",
  ].join("\n");
  return { prompt, pages };
}

/** What the agent writes as a page's translatedFrom when it's done with it (the prompt says so). */
export const DONE = "done";
/** A page the agent has marked done, for the dev server to stamp. */
export const markedDone = (text: string) =>
  new RegExp(`^${TRANSLATED_FROM}:\\s*"?${DONE}"?\\s*$`, "m").test(text);

/**
 * Record in a translated page which version of the original it was translated from:
 * `translatedFrom: "<hash>"` in its frontmatter (made if there's none, after a leading <script>).
 */
export function stamp(p: Project, file: string, by?: Provenance): void {
  const source = sourceOf(p.config);
  const pagesDir = join(p.root, "pages");
  const [segment, ...rest] = relative(pagesDir, file).split(sep);
  if (!segment || !rest.length || !p.config.locales.some((l) => l.segment === segment))
    throw new Error(`${relative(p.root, file)} isn't a page under pages/<locale>/`);
  const original = join(pagesDir, source.segment, ...rest);
  if (!existsSync(original))
    throw new Error(`no original for ${relative(p.root, file)} (${relative(p.root, original)})`);
  const line = `${TRANSLATED_FROM}: "${markdownHash(readFileSync(original, "utf8"))}"`;
  const text = readFileSync(file, "utf8");
  let out: string;
  if (TRANSLATED_FROM_LINE.test(text)) out = text.replace(TRANSLATED_FROM_LINE, line);
  else {
    const fm = frontmatter(text);
    if (fm) out = text.slice(0, fm.close) + `${line}\n` + text.slice(fm.close);
    else {
      const script = /^<script>[\s\S]*?<\/script>\n*/.exec(text)?.[0] ?? "";
      out = `${script}---\n${line}\n---\n\n${text.slice(script.length)}`;
    }
  }
  // Who translated it, when, and the gateway log of the request (plans/translation-provenance.md):
  // given by whoever just wrote it. An agent that marked the page done writes its own.
  if (by) {
    out = frontmatterLine(out, "translatedBy", by.by);
    out = frontmatterLine(out, "translatedAt", by.at ?? today());
    // Only a request's own log and cost: one left from an earlier translation would say a request
    // made this.
    if (by.gatewayLogId) out = frontmatterLine(out, "gatewayLogId", by.gatewayLogId);
    else out = out.replace(/^gatewayLogId:.*\n/m, "");
    // What it cost (plans/translation-simple.md), as one line of YAML (JSON is YAML).
    if (by.usage) out = frontmatterLine(out, "usage", by.usage);
    else out = out.replace(/^usage:.*\n/m, "");
    // A review was of what someone else wrote.
    out = out.replace(/^review(edBy|edAt|Note):.*\n/gm, "");
  }
  writeFileSync(file, out);
}

/**
 * Who made a page an agent marked done (`translatedFrom: done`): what it says, unless that's still
 * a model's id (an id with a "/", models.ts) — then the agent changed a page a model made and
 * didn't say who it is, so nobody can say: "unknown", and it's reviewed. An agent's page has no
 * gateway log either way.
 */
export function agentProvenance(text: string): Provenance {
  const said = /^translatedBy:\s*"?([^"\n]*)"?\s*$/m
    .exec(frontmatter(text)?.yaml ?? "")?.[1]
    ?.trim();
  return { by: said && !said.includes("/") ? said : "unknown" };
}

/**
 * Who translated something: a model's id, "claude", a person; when; the request's gateway log;
 * and what it cost.
 */
export interface Provenance {
  by: string;
  at?: string;
  gatewayLogId?: string;
  usage?: Spent;
}

/** `key: value` in a page's frontmatter (which stamp() has made sure is there): set or added. */
function frontmatterLine(text: string, key: string, value: string | object): string {
  const line = `${key}: ${JSON.stringify(value)}`;
  const existing = new RegExp(`^${key}:.*$`, "m");
  const fm = frontmatter(text)!;
  const head = text.slice(0, fm.close);
  if (existing.test(head)) return head.replace(existing, line) + text.slice(fm.close);
  return head + `${line}\n` + text.slice(fm.close);
}

/** The app's name, its package.json's, for the gateway's logs. */
export function appName(root: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name?: string }).name;
  } catch {
    return undefined;
  }
}

/** pnpm or npm, for messages: what the app is installed with. */
export function packageManager(root: string): "pnpm" | "npm" {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("npm")) return "npm";
  for (let d = root; d !== dirname(d); d = dirname(d)) {
    if (existsSync(join(d, "pnpm-workspace.yaml")) || existsSync(join(d, "pnpm-lock.yaml")))
      return "pnpm";
    if (existsSync(join(d, "package-lock.json"))) return "npm";
  }
  return "npm";
}

/** How to run a package's command in the app: `vp exec` in a Vite+ app, else its package manager's. */
export function runner(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pkg.devDependencies?.["vite-plus"] ?? pkg.dependencies?.["vite-plus"]) return "vp";
  } catch {}
  return packageManager(root);
}

/**
 * Claude Code (`claude`) is installed and signed in, so `claude -p` can run. A Claude cloud
 * session has `claude` but doesn't pass its sign-in to the commands it runs ("loggedIn": false).
 */
export function hasClaude(): boolean {
  const run = spawnSync("claude", ["auth", "status"], { encoding: "utf8" });
  if (run.status !== 0) return false;
  try {
    return JSON.parse(run.stdout).loggedIn === true;
  } catch {
    return false;
  }
}

/** The tools the agent gets: read and edit files, nothing that runs commands. */
export const AGENT_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"];

/**
 * Run `claude -p` in the app's folder, showing each file it reads or edits as it goes and its
 * final answer. Resolves with claude's exit code.
 */
export function runClaude(root: string, prompt: string): Promise<number> {
  const args = [
    "-p",
    prompt,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    AGENT_TOOLS.join(","),
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  const child = spawn("claude", args, { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) showEvent(root, line);
  });
  return new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
}

interface StreamEvent {
  type: string;
  subtype?: string;
  result?: string;
  message?: { content?: { type: string; name?: string; input?: Record<string, unknown> }[] };
}

function showEvent(root: string, line: string) {
  let event: StreamEvent;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  if (event.type === "assistant")
    for (const c of event.message?.content ?? []) {
      if (c.type !== "tool_use") continue;
      const target = [c.input?.file_path, c.input?.path, c.input?.pattern].find(
        (v): v is string => typeof v === "string",
      );
      const shown = target?.startsWith("/") ? relative(root, target) : (target ?? "");
      console.log(`  ${c.name} ${shown}`);
    }
  if (event.type === "result") {
    console.log("");
    console.log(event.result ?? `claude finished: ${event.subtype}`);
  }
}

/**
 * Translate what's new: Claude Code translates (`claude -p`, when it's signed in here), then the
 * pages it wrote are stamped and everything is checked. The dev server runs it straight after each
 * save's prepare (after Void's AI, when there's no Claude Code). Resolves with what's left: the
 * check's problems, and the prompt shown for a coding agent when there's no Claude Code.
 */
export async function translateApp(
  p: Project,
  root: string,
  log: (line: string) => void = console.log,
  handedOut?: string,
): Promise<{ problems: string[]; prompt?: string }> {
  const task = translateTask(p);
  if (!task) {
    // Nothing for an agent to do.
  } else if (!hasClaude()) {
    // No signed-in Claude Code: show the prompt for whatever coding agent the developer uses.
    // The same prompt as last time: don't show it again.
    if (task.prompt !== handedOut) {
      log(
        "No signed-in Claude Code (claude) here. Give this prompt to your coding agent; the dev server records each page marked done and reports what's left.\n",
      );
      log(task.prompt);
    }
    return { problems: check(p), prompt: task.prompt };
  } else {
    log(
      `\n$ claude -p <prompt> --permission-mode acceptEdits --allowedTools ${AGENT_TOOLS.join(",")}\n`,
    );
    log(task.prompt.replace(/^/gm, "  > "));
    log("");
    const before = new Map(
      task.pages.map((page) => [
        page.file,
        existsSync(page.file) ? readFileSync(page.file, "utf8") : undefined,
      ]),
    );
    const wasNew = newEntries(p);
    const code = await runClaude(root, task.prompt);
    markTranslatedBy(p, wasNew, "claude");
    if (code !== 0) log(`\nclaude exited with ${code}`);
    // Pages the agent wrote, and unrecorded ones it checked. An untouched stale page stays stale.
    const unrecorded = new Set(
      task.pages.filter((x) => x.state === "unrecorded").map((x) => x.file),
    );
    for (const [file, text] of before) {
      if (!existsSync(file)) continue;
      const changed = readFileSync(file, "utf8") !== text;
      if (!changed && !(code === 0 && unrecorded.has(file))) continue;
      // Claude wrote it only if it changed it: a page it only checked keeps who wrote it.
      stamp(p, file, changed ? { by: "claude" } : undefined);
      log(`stamped ${relative(root, file)}`);
    }
  }
  return { problems: check(p) };
}

/** Each language's catalog, read. */
function catalogsOf(
  p: Project,
): { locale: string; file: string; catalog: { translations: Record<string, CatalogEntry> } }[] {
  return missing(p)
    .map((m) => ({ locale: m.locale, file: catalogFile(p, m.locale) }))
    .filter(({ file }) => existsSync(file))
    .map((c) => ({ ...c, catalog: JSON.parse(readFileSync(c.file, "utf8")) }));
}

/** Whether an entry waits for review: translated by an AI (not by Claude or a person), not yet reviewed. */
export const awaitsReview = (e: CatalogEntry) =>
  e.status !== "new" && !!e.translatedBy && e.translatedBy !== "claude" && !e.review;

/**
 * Whether a translated page waits for review, as an entry does: its frontmatter's `translatedBy`
 * isn't "claude" (a model's id, "unknown") and it has no `reviewedBy`.
 */
export function pageAwaitsReview(text: string): boolean {
  const yaml = frontmatter(text)?.yaml ?? "";
  const by = /^translatedBy:\s*"?([^"\n]*)"?\s*$/m.exec(yaml)?.[1]?.trim();
  return !!by && by !== "claude" && !/^reviewedBy:\s*\S/m.test(yaml);
}

/** The translated pages that wait for review (up-to-date ones: a stale page is retranslated first). */
export function unreviewedPages(p: Project): MarkdownPage[] {
  return markdownPages(p).filter(
    (page) => page.state === "ok" && pageAwaitsReview(readFileSync(page.file, "utf8")),
  );
}

/** What waits for review, said: "th-TH 3, ar-EG 1, 2 pages", or "" for nothing. */
export function waitingReview(p: Project): string {
  const entries = [...unreviewed(p)].filter(([, n]) => n).map(([l, n]) => `${l} ${n}`);
  const pages = unreviewedPages(p).length;
  if (pages) entries.push(pages === 1 ? "1 page" : `${pages} pages`);
  return entries.join(", ");
}

/** How many translations wait for review, by language. */
export function unreviewed(p: Project): Map<string, number> {
  return new Map(
    catalogsOf(p).map(({ locale, catalog }) => [
      locale,
      Object.values(catalog.translations).filter(awaitsReview).length,
    ]),
  );
}

/**
 * What's left to review, as a prompt for a coding agent: each catalog with translations an AI
 * wrote and no one has reviewed. The void-fbtee skill's "Reviewing" says how (and what to write
 * in each entry). Undefined when there's nothing.
 */
export function reviewTask(p: Project): string | undefined {
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");
  const lines = [...unreviewed(p)]
    .filter(([, n]) => n)
    .map(([locale, n]) => `- ${rel(catalogFile(p, locale))} (${locale}): ${n} entries to review`);
  const pages = unreviewedPages(p).map(
    (page) => `- ${rel(page.file)} (${page.locale}), translated from ${rel(page.original)}`,
  );
  if (!lines.length && !pages.length) return;
  return [
    `Review this Void app's machine translations. First read ${skillPath(p.root)} (the void-fbtee skill), its "Reviewing" section, and follow it.`,
    ...(lines.length ? ["", "Catalogs:", ...lines] : []),
    ...(pages.length ? ["", "Pages:", ...pages] : []),
    "",
    'Review the entries and pages with a translatedBy that isn\'t "claude" and no review. Edit only these files.',
    "Finish with one line per file: how many were right, how many you corrected, and what was wrong.",
  ].join("\n");
}

/**
 * Claude's review of what an AI translated, as `vp dev` runs it after translating: `claude -p` when
 * it's signed in here, else the prompt for the developer's coding agent (shown once). Then the
 * checks, on the reviewer's corrections too.
 */
export async function reviewApp(
  p: Project,
  root: string,
  log: (line: string) => void = console.log,
  handedOut?: string,
): Promise<{ problems: string[]; prompt?: string }> {
  const prompt = reviewTask(p);
  if (!prompt) return { problems: check(p) };
  if (!hasClaude()) {
    if (prompt !== handedOut) {
      log(
        "No signed-in Claude Code (claude) here. Give this review prompt to your coding agent:\n",
      );
      log(prompt);
    }
    return { problems: check(p), prompt };
  }
  log(
    `\n$ claude -p <review prompt> --permission-mode acceptEdits --allowedTools ${AGENT_TOOLS.join(",")}\n`,
  );
  log(prompt.replace(/^/gm, "  > "));
  const code = await runClaude(root, prompt);
  if (code !== 0) log(`\nclaude exited with ${code}`);
  return { problems: check(p) };
}

/** Each language's entries still marked new, by hash. */
function newEntries(p: Project): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of missing(p)) {
    const file = catalogFile(p, m.locale);
    if (!existsSync(file)) continue;
    const catalog = JSON.parse(readFileSync(file, "utf8")) as {
      translations: Record<string, CatalogEntry>;
    };
    out.set(
      m.locale,
      new Set(
        Object.entries(catalog.translations)
          .filter(([, e]) => e.status === "new")
          .map(([h]) => h),
      ),
    );
  }
  return out;
}

/**
 * Record who wrote the entries that were new and are now translated (step 4 of
 * plans/translation-rework.md): an agent edits the files itself, so it's done after it finishes.
 */
function markTranslatedBy(p: Project, wasNew: Map<string, Set<string>>, by: string): void {
  for (const [locale, hashes] of wasNew) {
    const file = catalogFile(p, locale);
    if (!existsSync(file) || !hashes.size) continue;
    const text = readFileSync(file, "utf8");
    const catalog = JSON.parse(text) as { translations: Record<string, CatalogEntry> };
    for (const h of hashes) {
      const e = catalog.translations[h];
      if (!e || e.status === "new" || e.translatedBy) continue;
      e.translatedBy = by;
      e.translatedAt = today();
    }
    const out = JSON.stringify(catalog, null, 2) + "\n";
    if (out !== text) writeFileSync(file, out);
  }
}

interface CatalogLine {
  translation: string;
  variations: Record<string, number>;
}
interface CatalogEntry {
  description?: string;
  status?: string;
  translations?: CatalogLine[];
  /** Who wrote the translation: a model's id, "claude", a person, or "unknown" when nothing said
   * (plans/translation-provenance.md). Every finished entry has one (check.ts). */
  translatedBy?: string;
  /** The day it was written, YYYY-MM-DD. */
  translatedAt?: string;
  /** The AI Gateway log of the request that wrote it: its exact request and answer. */
  gatewayLogId?: string;
  /** What it cost: the request's tokens, and the US$ they came to that day (models.ts spent). */
  usage?: Spent;
  /** Claude's review of a translation an AI wrote (reviewTask). Cleared when it's translated again. */
  review?: Review;
}

/**
 * A reviewer's verdict on one entry, kept in the entry (plans/translation-rework.md, step 6):
 * "ok", or "wrong" with what was wrong (`note`), the translator it judged (`of`) and its lines
 * (`was`), the reviewer's correction being the entry's lines now.
 */
export interface Review {
  by: string;
  at: string;
  verdict: "ok" | "wrong";
  of?: string;
  note?: string;
  was?: string[];
}

/** Run `work` on every item, `n` at a time, in order. */
async function inTurn<T, R>(items: T[], n: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n)
    out.push(...(await Promise.all(items.slice(i, i + n).map(work))));
  return out;
}

/** How many requests go to Void's AI at once: one string each (plans/translation-simple.md). */
const AT_ONCE = 4;

/** The dev server's route's answer (ai.ts devTranslate): a translation, its problems, cost, log. */
export interface RouteAnswer {
  result?: unknown;
  problems?: string[];
  usage?: Spent;
  logId?: string;
}

/**
 * One request to the dev server's translate route (ai.ts devTranslate). Undefined: no Void's AI,
 * or not paid for now. An answer with no `result`: it was unusable.
 */
export type TranslateCall = (body: object) => Promise<RouteAnswer | undefined>;

/**
 * Requests to the dev server's translate route (ai.ts devTranslate). Undefined: Void's AI isn't
 * there (503), or not paid for now (402, 429: credits used up, a spend limit reached); no result:
 * an answer that couldn't be used (502).
 */
export function routeCall(
  url: string,
  token: string,
  log: (line: string) => void,
  app?: string,
): TranslateCall {
  let paymentSaid = false;
  let gone = false;
  return async (body) => {
    if (gone) return undefined;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-void-fbtee-token": token },
      body: JSON.stringify({ ...body, app }),
    });
    if (res.status === 503) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      if (!gone)
        log(`Void's AI isn't available here (${error ?? "no answer"}), so Claude Code translates`);
      gone = true;
      return undefined;
    }
    if (res.status === 402 || res.status === 429) {
      // Not paid for now: asking again would only fail again. The rest is left new, for Claude
      // Code, or the next save once credits are back.
      if (!paymentSaid)
        log(`Void's AI stopped: ${paymentAdvice[res.status === 402 ? "credits" : "limit"]}`);
      paymentSaid = true;
      gone = true;
      return undefined;
    }
    if (res.status === 502) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      log(`Void's AI gave an unusable answer (${error ?? "no answer"})`);
      return {};
    }
    if (!res.ok) throw new Error(`the dev server's translate route answered ${res.status}`);
    return (await res.json()) as RouteAnswer;
  };
}

/** Today, as a catalog records it: YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10);

/** A line's forms as one key, to match a line with its source line: `{"0":20,"1":2}`. */
const formsOf = (v: Record<string, number> | undefined) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(v ?? {}).sort(([a], [b]) => Number(a) - Number(b))),
  );

/**
 * What an entry is translated from: its lines in the source language, from what fbtee collects
 * from the code (catalogs.ts freshCatalog), each matched to the catalog's line by the forms it's
 * for. Never the catalog's own line: once a line is added to a translated entry (a language's new
 * plural form), it holds the translation, not the source. Undefined when the code no longer has it.
 */
function sourceEntry(entry: CatalogEntry, fresh: CatalogEntry | undefined): Entry | undefined {
  if (!fresh?.translations?.length || !entry.translations?.length) return;
  const byForms = new Map(fresh.translations.map((l) => [formsOf(l.variations), l.translation]));
  const lines = entry.translations.map((l) => ({
    text: byForms.get(formsOf(l.variations)),
    variations: l.variations ?? {},
  }));
  if (lines.some((l) => l.text === undefined)) return;
  return {
    description: entry.description ?? fresh.description ?? "",
    lines: lines as Entry["lines"],
  };
}

/**
 * Every new entry of one language's catalog through Void's AI, one entry a request, a few at once
 * (AT_ONCE). Each answer is checked in the Worker (ai.ts translateString: asked once more if
 * anything was wrong); one with no problems is written into the catalog object, with who, when,
 * its log and its cost; the file is the caller's. Undefined when Void's AI isn't there.
 */
export async function translateCatalog(
  p: Project,
  call: TranslateCall,
  locale: string,
  catalog: { translations: Record<string, CatalogEntry> },
  log: (line: string) => void,
): Promise<{ done: number; open: number; usd: number } | undefined> {
  const { texts, builtinHashes } = collect(p);
  const fresh = (
    JSON.parse(freshCatalog(p, locale)) as { translations: Record<string, CatalogEntry> }
  ).translations;
  const open = Object.entries(catalog.translations).filter(
    ([, e]) => e.status === "new" && e.translations?.length,
  );
  let usd = 0;
  let done = 0;
  let gone = false;
  await inTurn(open, AT_ONCE, async ([hash, entry]) => {
    const source = sourceEntry(entry, fresh[hash]);
    if (!source || gone) return;
    const answer = await call({
      kind: "string",
      from: sourceLanguageOf(hash, builtinHashes, p.config.sourceLocale),
      to: locale,
      entry: source,
    });
    if (!answer) {
      gone = true;
      return;
    }
    usd += answer.usage?.usd ?? 0;
    const lines = answer.result as (string | null | undefined)[] | undefined;
    if (!lines || answer.problems?.length) {
      if (answer.problems?.length)
        log(`${texts[hash] ?? hash} → ${JSON.stringify(lines)}: ${answer.problems.join(" ")}`);
      return;
    }
    entry.translations = entry.translations!.map((l, k) => ({ ...l, translation: lines[k]! }));
    entry.status = "translated";
    entry.translatedBy = GEMINI.id;
    entry.translatedAt = today();
    if (answer.logId) entry.gatewayLogId = answer.logId;
    else delete entry.gatewayLogId;
    if (answer.usage) entry.usage = answer.usage;
    else delete entry.usage;
    delete entry.review;
    done++;
  });
  if (gone && !done) return;
  return { done, open: open.length, usd };
}

/**
 * Translate what's new with Void's AI, through the dev server's own route (ai.ts devTranslate,
 * in the app's Worker): every catalog's new entries and every markdown page missing or out of
 * date, all at once (translateCatalog, routeCall). Only what passes is written: an entry marked
 * translated, a page stamped after its kept parts are checked (check.ts keptParts). Resolves false
 * when Void's AI isn't there (the app doesn't use `void/ai`, or no Cloudflare sign-in); what
 * passed is still written.
 */
export async function translateWithVoidAi(
  p: Project,
  url: string,
  token: string,
  log: (line: string) => void,
): Promise<boolean> {
  const call = routeCall(url, token, log, appName(p.root));
  const from = p.config.sourceLocale;
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");

  const catalogs = missing(p).map(async (m) => {
    const file = catalogFile(p, m.locale);
    if (!existsSync(file)) return true;
    const catalog = JSON.parse(readFileSync(file, "utf8")) as {
      translations: Record<string, CatalogEntry>;
    };
    const ran = await translateCatalog(p, call, m.locale, catalog, log);
    // Saves don't wait for translating: a prepare may have changed the file meanwhile (a string
    // dropped, a new one added). So what passed goes into the file as it is now, each only where
    // its entry is still there and still new. What passed is written even when another answer
    // found Void's AI gone.
    const now = JSON.parse(readFileSync(file, "utf8")) as typeof catalog;
    let changed = false;
    for (const [hash, entry] of Object.entries(catalog.translations)) {
      const there = now.translations[hash];
      if (entry.status === "translated" && there?.status === "new") {
        now.translations[hash] = entry;
        changed = true;
      }
    }
    if (changed) writeFileSync(file, JSON.stringify(now, null, 2) + "\n");
    if (ran?.open)
      log(
        `${rel(file)}: ${ran.done} of ${ran.open} translated with ${GEMINI.id}, US$${ran.usd.toFixed(4)}`,
      );
    return !!ran;
  });

  const source = sourceOf(p.config);
  const pages = markdownPages(p)
    .filter((page) => page.state === "missing" || page.state === "stale")
    .map(async (page) => {
      const original = readFileSync(page.original, "utf8");
      const answer = await call({ kind: "page", from, to: page.locale, text: original });
      if (!answer) return false;
      log(`${rel(page.file)}: asked ${GEMINI.id}, US$${(answer.usage?.usd ?? 0).toFixed(4)}`);
      const copy = typeof answer.result === "string" ? answer.result : "";
      if (!copy.trim()) return true;
      const same = (a: string[], b: string[]) => a.join("\n") === b.join("\n");
      if (missingHead(original, copy).length || !same(keptParts(original), keptParts(copy))) {
        log(`${rel(page.file)}: Void's AI changed what a copy must keep; left for another way`);
        return true;
      }
      mkdirSync(dirname(page.file), { recursive: true });
      writeFileSync(page.file, copy.endsWith("\n") ? copy : copy + "\n");
      stamp(p, page.file, { by: GEMINI.id, gatewayLogId: answer.logId, usage: answer.usage });
      log(`${rel(page.file)}: translated with Void's AI from ${source.segment}/${page.path}`);
      return true;
    });
  return (await Promise.all([...catalogs, ...pages])).every(Boolean);
}
