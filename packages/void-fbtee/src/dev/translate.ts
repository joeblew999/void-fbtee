// Translating, as `vp dev` does it (plugin.ts): the work goes to a coding agent, `claude -p` with
// void-fbtee's skill, allowed to read and edit files and nothing else, when `claude` is installed
// and signed in. The skill does the translating; this file only says
// what's missing, records each translated page's original, and checks the result.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogFile, collect, freshCatalog, missing, type Project } from "./catalogs";
import { isSpent, readCatalog, type CatalogEntry, type CatalogLine } from "./catalog-file";
import { field, isRecord, isStringArray, parseJson, present, textField } from "../guards";

export type { Review } from "./catalog-file";
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
import { sourceOf } from "../locales";
import { sourceLanguageOf } from "../judge";
import { check } from "./check";
import { GEMINI, paymentAdvice, type Spent } from "../models";
import type { Entry } from "../gemini";

/** void-fbtee's own folder, where skills/ ships: the nearest one up with a package.json, so the
 * same from dist/ (built) and from src/dev/ (the tests). */
export function packageDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    dir = dirname(dir);
  }
  return dir;
}

/** The skill as the app sees it: through node_modules if it's installed there. */
export function skillPath(root: string): string {
  const installed = join(root, "node_modules/void-fbtee/skills/void-fbtee/SKILL.md");
  if (existsSync(installed)) {
    return relative(root, installed);
  }
  return relative(root, join(packageDir(), "skills/void-fbtee/SKILL.md"));
}

export interface TranslateTask {
  /** The prompt for the agent; one line per file to work on. */
  prompt: string;
  /** Markdown pages to translate (their translatedFrom is recorded afterwards). */
  pages: Array<MarkdownPage>;
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
      ok: "",
    }[page.state];
    return `- ${rel(page.file)} (${page.locale}): ${what}`;
  });
  if (!strings.length && !pageLines.length) {
    return;
  }
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
  if (!segment || !rest.length || !p.config.locales.some((l) => l.segment === segment)) {
    throw new Error(`${relative(p.root, file)} isn't a page under pages/<locale>/`);
  }
  const original = join(pagesDir, source.segment, ...rest);
  if (!existsSync(original)) {
    throw new Error(`no original for ${relative(p.root, file)} (${relative(p.root, original)})`);
  }
  const line = `${TRANSLATED_FROM}: "${markdownHash(readFileSync(original, "utf8"))}"`;
  const text = readFileSync(file, "utf8");
  let out: string;
  if (TRANSLATED_FROM_LINE.test(text)) {
    out = text.replace(TRANSLATED_FROM_LINE, line);
  } else {
    const fm = frontmatter(text);
    if (fm) {
      out = text.slice(0, fm.close) + `${line}\n` + text.slice(fm.close);
    } else {
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
    if (by.gatewayLogId) {
      out = frontmatterLine(out, "gatewayLogId", by.gatewayLogId);
    } else {
      out = out.replace(/^gatewayLogId:.*\n/m, "");
    }
    // What it cost (plans/translation-simple.md), as one line of YAML (JSON is YAML).
    if (by.usage) {
      out = frontmatterLine(out, "usage", by.usage);
    } else {
      out = out.replace(/^usage:.*\n/m, "");
    }
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

/** `key: value` in a page's frontmatter: set, or added, with the frontmatter itself when the page
 * has none (a page someone wrote without it). */
function frontmatterLine(text: string, key: string, value: string | object): string {
  const line = `${key}: ${JSON.stringify(value)}`;
  const existing = new RegExp(`^${key}:.*$`, "m");
  const fm = frontmatter(text);
  if (!fm) {
    return `---\n${line}\n---\n${text}`;
  }
  const head = text.slice(0, fm.close);
  if (existing.test(head)) {
    return head.replace(existing, line) + text.slice(fm.close);
  }
  return head + `${line}\n` + text.slice(fm.close);
}

/** The app's name, its package.json's, for the gateway's logs. */
export function appName(root: string): string | undefined {
  try {
    return textField(parseJson(readFileSync(join(root, "package.json"), "utf8")), "name");
  } catch {
    return undefined;
  }
}

/** pnpm or npm, for messages: what the app is installed with. */
export function packageManager(root: string): "pnpm" | "npm" {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) {
    return "pnpm";
  }
  if (agent.startsWith("npm")) {
    return "npm";
  }
  for (let d = root; d !== dirname(d); d = dirname(d)) {
    if (existsSync(join(d, "pnpm-workspace.yaml")) || existsSync(join(d, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(d, "package-lock.json"))) {
      return "npm";
    }
  }
  return "npm";
}

/** How to run a package's command in the app: `vp exec` in a Vite+ app, else its package manager's. */
export function runner(root: string): string {
  try {
    const pkg = parseJson(readFileSync(join(root, "package.json"), "utf8"));
    const has = (list: string) => field(field(pkg, list), "vite-plus") !== undefined;
    if (has("devDependencies") || has("dependencies")) {
      return "vp";
    }
  } catch {
    // No package.json to read: the package manager decides.
  }
  return packageManager(root);
}

/**
 * Claude Code (`claude`) is installed and signed in, so `claude -p` can run. A Claude cloud
 * session has `claude` but doesn't pass its sign-in to the commands it runs ("loggedIn": false).
 */
export function hasClaude(): boolean {
  const run = spawnSync("claude", ["auth", "status"], { encoding: "utf8" });
  if (run.status !== 0) {
    return false;
  }
  try {
    return field(parseJson(run.stdout), "loggedIn") === true;
  } catch {
    return false;
  }
}

/** The tools the agent gets: read and edit files, nothing that runs commands. */
export const AGENT_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"];

/**
 * Run `claude -p` in the app's folder, showing each file it reads or edits as it goes and its
 * final answer, through `print` (the dev server passes its log, so it's in DevTools' terminal too).
 * Resolves with claude's exit code. `signal` stops it (Node kills the child): the dev server
 * closing does that, so no agent outlives it.
 */
export function runClaude(
  root: string,
  prompt: string,
  signal?: AbortSignal,
  print: (line: string) => void = console.log,
): Promise<number> {
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
  const child = spawn("claude", args, { cwd: root, stdio: ["ignore", "pipe", "inherit"], signal });
  // Stopped by the signal, Node reports an AbortError here and then closes the child: the close
  // below resolves, so this only keeps the error from going unhandled.
  child.on("error", () => {});
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      showEvent(root, line, print);
    }
  });
  return new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
}

/** One line of `claude -p --output-format stream-json`, shown as it comes: each tool it uses, and its
 * result. Read field by field: a line that isn't that shape shows nothing. */
function showEvent(root: string, line: string, print: (line: string) => void) {
  let event: unknown;
  try {
    event = parseJson(line);
  } catch {
    return;
  }
  const type = textField(event, "type");
  if (type === "assistant") {
    const content = field(field(event, "message"), "content");
    const parts: Array<unknown> = Array.isArray(content) ? content : [];
    for (const c of parts) {
      if (textField(c, "type") !== "tool_use") {
        continue;
      }
      const input = field(c, "input");
      const target = [
        field(input, "file_path"),
        field(input, "path"),
        field(input, "pattern"),
      ].find((v): v is string => typeof v === "string");
      const shown = target?.startsWith("/") ? relative(root, target) : (target ?? "");
      print(`  ${textField(c, "name") ?? ""} ${shown}`);
    }
  }
  if (type === "result") {
    print("");
    print(textField(event, "result") ?? `claude finished: ${textField(event, "subtype") ?? ""}`);
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
  signal?: AbortSignal,
): Promise<{ problems: Array<string>; prompt?: string }> {
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
    const code = await runClaude(root, task.prompt, signal, log);
    // Stopped part way (the dev server closed): nothing is marked or stamped as Claude's.
    if (signal?.aborted) {
      return { problems: [] };
    }
    markTranslatedBy(p, wasNew, "claude");
    if (code !== 0) {
      log(`\nclaude exited with ${code}`);
    }
    // Pages the agent wrote, and unrecorded ones it checked. An untouched stale page stays stale.
    const unrecorded = new Set(
      task.pages.filter((x) => x.state === "unrecorded").map((x) => x.file),
    );
    for (const [file, text] of before) {
      if (!existsSync(file)) {
        continue;
      }
      const changed = readFileSync(file, "utf8") !== text;
      if (!changed && !(code === 0 && unrecorded.has(file))) {
        continue;
      }
      // Claude wrote it only if it changed it: a page it only checked keeps who wrote it.
      stamp(p, file, changed ? { by: "claude" } : undefined);
      log(`stamped ${relative(root, file)}`);
    }
  }
  return { problems: check(p) };
}

/** Each language's catalog, read. */
function catalogsOf(p: Project): Array<{
  locale: string;
  file: string;
  catalog: { translations: Record<string, CatalogEntry> };
}> {
  return missing(p)
    .map((m) => ({ locale: m.locale, file: catalogFile(p, m.locale) }))
    .filter(({ file }) => existsSync(file))
    .map((c) => ({ ...c, catalog: readCatalog(readFileSync(c.file, "utf8"), c.file) }));
}

/**
 * Whether a translation was made by a machine, or nobody can say who made it: a model's id (with a
 * "/", models.ts) or "unknown". Those are reviewed; Claude's and a person's aren't (the void-fbtee
 * skill's "Reviewing").
 */
const byMachine = (by: string | undefined) => !!by && (by === "unknown" || by.includes("/"));

/** Whether an entry waits for review: by a machine or nobody known, not yet reviewed. */
export const awaitsReview = (e: CatalogEntry) =>
  e.status !== "new" && byMachine(e.translatedBy) && !e.review;

/**
 * Whether a translated page waits for review, as an entry does: its frontmatter's `translatedBy`
 * is a model's id or "unknown", and it has no `reviewedBy`.
 */
export function pageAwaitsReview(text: string): boolean {
  const yaml = frontmatter(text)?.yaml ?? "";
  const by = /^translatedBy:\s*"?([^"\n]*)"?\s*$/m.exec(yaml)?.[1]?.trim();
  return byMachine(by) && !/^reviewedBy:\s*\S/m.test(yaml);
}

/** The translated pages that wait for review (up-to-date ones: a stale page is retranslated first). */
export function unreviewedPages(p: Project): Array<MarkdownPage> {
  return markdownPages(p).filter(
    (page) => page.state === "ok" && pageAwaitsReview(readFileSync(page.file, "utf8")),
  );
}

/** What waits for review, said: "th-TH 3, ar-EG 1, 2 pages", or "" for nothing. */
export function waitingReview(p: Project): string {
  const entries = [...unreviewed(p)].filter(([, n]) => n).map(([l, n]) => `${l} ${n}`);
  const pages = unreviewedPages(p).length;
  if (pages) {
    entries.push(pages === 1 ? "1 page" : `${pages} pages`);
  }
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
  if (!lines.length && !pages.length) {
    return;
  }
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
  signal?: AbortSignal,
): Promise<{ problems: Array<string>; prompt?: string }> {
  const prompt = reviewTask(p);
  if (!prompt) {
    return { problems: check(p) };
  }
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
  const code = await runClaude(root, prompt, signal, log);
  if (signal?.aborted) {
    return { problems: [] };
  }
  if (code !== 0) {
    log(`\nclaude exited with ${code}`);
  }
  return { problems: check(p) };
}

/** Each language's entries still marked new, by hash. */
function newEntries(p: Project): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of missing(p)) {
    const file = catalogFile(p, m.locale);
    if (!existsSync(file)) {
      continue;
    }
    const catalog = readCatalog(readFileSync(file, "utf8"), file);
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
    if (!existsSync(file) || !hashes.size) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    const catalog = readCatalog(text, file);
    for (const h of hashes) {
      const e = catalog.translations[h];
      if (!e || e.status === "new" || e.translatedBy) {
        continue;
      }
      e.translatedBy = by;
      e.translatedAt = today();
    }
    const out = JSON.stringify(catalog, null, 2) + "\n";
    if (out !== text) {
      writeFileSync(file, out);
    }
  }
}

/**
 * Run `work` on every item, at most `n` at once: the next starts as soon as any finishes. Not in
 * groups that wait for their slowest: Gemini 4 Hydrogen thinks before it answers, so one string
 * can take three or four times as long as the next (102 to 797 thinking tokens on test/answers.json,
 * 2026-11-18), and a group would leave the other slots idle (plans/reliable-work.md).
 */
async function inTurn<T, R>(
  items: Array<T>,
  n: number,
  work: (item: T) => Promise<R>,
): Promise<Array<R>> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(present(items[i], `item ${i} of ${items.length}`));
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/** How many requests go to Void's AI at once: one string each (plans/translation-simple.md). */
const AT_ONCE = 4;

/** The dev server's route's answer (ai.ts devTranslate): a translation, its problems, cost, log. */
const isRouteAnswer = (value: unknown): value is RouteAnswer =>
  isRecord(value) &&
  (value.problems === undefined || isStringArray(value.problems)) &&
  (value.usage === undefined || isSpent(value.usage)) &&
  (value.logId === undefined || typeof value.logId === "string");

export interface RouteAnswer {
  result?: unknown;
  problems?: Array<string>;
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
  signal?: AbortSignal,
): TranslateCall {
  let paymentSaid = false;
  let gone = false;
  return async (body) => {
    if (gone) {
      return undefined;
    }
    // `signal` stops a request in flight (the dev server closing): fetch then throws, and nothing
    // from it is written.
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-void-fbtee-token": token },
      body: JSON.stringify({ ...body, app }),
      signal,
    });
    if (res.status === 503) {
      const error = textField(await res.json().catch(() => undefined), "error");
      if (!gone) {
        log(`Void's AI isn't available here (${error ?? "no answer"}), so Claude Code translates`);
      }
      gone = true;
      return undefined;
    }
    if (res.status === 402 || res.status === 429) {
      // Not paid for now: asking again would only fail again. The rest is left new, for Claude
      // Code, or the next save once credits are back.
      if (!paymentSaid) {
        log(`Void's AI stopped: ${paymentAdvice[res.status === 402 ? "credits" : "limit"]}`);
      }
      paymentSaid = true;
      gone = true;
      return undefined;
    }
    if (res.status === 502) {
      const error = textField(await res.json().catch(() => undefined), "error");
      log(`Void's AI gave an unusable answer (${error ?? "no answer"})`);
      return {};
    }
    if (!res.ok) {
      throw new Error(`the dev server's translate route answered ${res.status}`);
    }
    const answer: unknown = await res.json();
    if (!isRouteAnswer(answer)) {
      throw new Error("the dev server's translate route gave no answer");
    }
    return answer;
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
  if (!fresh?.translations?.length || !entry.translations?.length) {
    return;
  }
  const byForms = new Map(fresh.translations.map((l) => [formsOf(l.variations), l.translation]));
  const lines: Entry["lines"] = [];
  for (const l of entry.translations) {
    const text = byForms.get(formsOf(l.variations));
    if (text === undefined) {
      return;
    }
    lines.push({ text, variations: l.variations ?? {} });
  }
  return { description: entry.description ?? fresh.description ?? "", lines };
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
  const fresh = readCatalog(
    freshCatalog(p, locale),
    `the ${locale} strings in the code`,
  ).translations;
  const open = Object.entries(catalog.translations).filter(
    ([, e]) => e.status === "new" && e.translations?.length,
  );
  let usd = 0;
  let done = 0;
  let gone = false;
  await inTurn(open, AT_ONCE, async ([hash, entry]) => {
    const source = sourceEntry(entry, fresh[hash]);
    if (!source || gone) {
      return;
    }
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
    const result = answer.result;
    const lines =
      Array.isArray(result) &&
      result.every(
        (l: unknown): l is string | null | undefined => l == null || typeof l === "string",
      )
        ? result
        : undefined;
    if (!lines || answer.problems?.length) {
      if (answer.problems?.length) {
        log(`${texts[hash] ?? hash} → ${JSON.stringify(lines)}: ${answer.problems.join(" ")}`);
      }
      return;
    }
    // Every line answered, or the answer isn't used: a line left out isn't stored as nothing.
    const answered: Array<CatalogLine> = [];
    for (const [k, l] of (entry.translations ?? []).entries()) {
      const translation = lines[k];
      if (typeof translation !== "string") {
        log(`${texts[hash] ?? hash}: Void's AI left line ${k + 1} out; asked again later`);
        return;
      }
      answered.push({ ...l, translation });
    }
    entry.translations = answered;
    entry.status = "translated";
    entry.translatedBy = GEMINI.id;
    entry.translatedAt = today();
    if (answer.logId) {
      entry.gatewayLogId = answer.logId;
    } else {
      delete entry.gatewayLogId;
    }
    if (answer.usage) {
      entry.usage = answer.usage;
    } else {
      delete entry.usage;
    }
    delete entry.review;
    done++;
  });
  if (gone && !done) {
    return;
  }
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
  signal?: AbortSignal,
): Promise<boolean> {
  const call = routeCall(url, token, log, appName(p.root), signal);
  const from = p.config.sourceLocale;
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");

  const catalogs = missing(p).map(async (m) => {
    const file = catalogFile(p, m.locale);
    if (!existsSync(file)) {
      return true;
    }
    const catalog = readCatalog(readFileSync(file, "utf8"), file);
    const ran = await translateCatalog(p, call, m.locale, catalog, log);
    // Saves don't wait for translating: a prepare may have changed the file meanwhile (a string
    // dropped, a new one added). So what passed goes into the file as it is now, each only where
    // its entry is still there and still new. What passed is written even when another answer
    // found Void's AI gone.
    const now = readCatalog(readFileSync(file, "utf8"), file);
    let changed = false;
    for (const [hash, entry] of Object.entries(catalog.translations)) {
      const there = now.translations[hash];
      if (entry.status === "translated" && there?.status === "new") {
        now.translations[hash] = entry;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(file, JSON.stringify(now, null, 2) + "\n");
    }
    if (ran?.open) {
      log(
        `${rel(file)}: ${ran.done} of ${ran.open} translated with ${GEMINI.id}, US$${ran.usd.toFixed(4)}`,
      );
    }
    return !!ran;
  });

  const source = sourceOf(p.config);
  const pages = markdownPages(p)
    .filter((page) => page.state === "missing" || page.state === "stale")
    .map(async (page) => {
      const original = readFileSync(page.original, "utf8");
      const answer = await call({ kind: "page", from, to: page.locale, text: original });
      if (!answer) {
        return false;
      }
      log(`${rel(page.file)}: asked ${GEMINI.id}, US$${(answer.usage?.usd ?? 0).toFixed(4)}`);
      const copy = typeof answer.result === "string" ? answer.result : "";
      if (!copy.trim()) {
        return true;
      }
      const same = (a: Array<string>, b: Array<string>) => a.join("\n") === b.join("\n");
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
