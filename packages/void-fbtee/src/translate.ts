// Translating, as `vp dev` does it (plugin.ts): the work goes to a coding agent, `claude -p` with
// void-fbtee's skill, allowed to read and edit files and nothing else, or the Claude Code session
// the dev server runs in, given the prompt. The skill does the translating; this file only says
// what's missing, records each translated page's original, and checks the result.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogFile, collect, missing, type Project } from "./catalogs";
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
import { glossaryMisses, keptTerms, problemsWith } from "./judge";
import { check } from "./check";
import { LLAMA, modelById, modelFor, type TranslationModel } from "./models";

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
    `Translate this Void app. First read ${skillPath(p.root)} (the void-fbtee skill) and follow it; ` +
      `how to translate is in ${translatingSkillPath(p.root)}.`,
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
export function stamp(p: Project, file: string): void {
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
  writeFileSync(file, out);
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

/** Running inside a Claude Code session (it sets CLAUDECODE=1 for the commands it runs). */
export const insideClaudeCode = () => process.env.CLAUDECODE === "1";

export const hasClaude = () => spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0;

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
 * Translate what's new: Claude Code translates (a `claude -p` here, or the Claude Code session the
 * dev server runs in, given the prompt), then the pages it wrote are stamped and everything is
 * checked. The dev server runs it once you pause after a save. Resolves with what's left: the
 * check's problems, or the prompt handed to the session.
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
  } else if (insideClaudeCode() || !hasClaude()) {
    // Inside Claude Code already (it sets CLAUDECODE=1 in its shell): that agent does the work.
    // A second `claude -p` started there has no sign-in of its own in a Claude cloud session, and
    // on a laptop it would be a second agent without the first one's context.
    // The same prompt as last time: the session is still on it, so don't show it again.
    if (task.prompt !== handedOut) {
      log(
        insideClaudeCode()
          ? "You're running in Claude Code, so translate in this session: follow this prompt. The dev server records each page marked done and reports what's left.\n"
          : "Claude Code (claude) isn't installed here. Give this prompt to your coding agent; the dev server records each page marked done and reports what's left.\n",
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
    const code = await runClaude(root, task.prompt);
    if (code !== 0) log(`\nclaude exited with ${code}`);
    // Pages the agent wrote, and unrecorded ones it checked. An untouched stale page stays stale.
    const unrecorded = new Set(
      task.pages.filter((x) => x.state === "unrecorded").map((x) => x.file),
    );
    for (const [file, text] of before) {
      if (!existsSync(file)) continue;
      if (readFileSync(file, "utf8") === text && !(code === 0 && unrecorded.has(file))) continue;
      stamp(p, file);
      log(`stamped ${relative(root, file)}`);
    }
  }
  return { problems: check(p) };
}

interface CatalogLine {
  translation: string;
  variations: Record<string, number>;
}
interface CatalogEntry {
  description?: string;
  /** Not in fbtee's file: the source text, added here for examplesFor. */
  source?: string;
  status?: string;
  translations?: CatalogLine[];
}

/**
 * fbtee's own rules for translating its catalog entries: its skill's steps 3 to 5 (match the
 * catalog's style, read the description and the code, keep placeholders, the plural and gender
 * variants), from the app's installed fbtee, so they're always that fbtee's own. The other steps
 * are commands for an agent. Sent with every `<fbt>` request (ai.ts rulesFor).
 */
export function fbteeRules(root: string): string | undefined {
  try {
    const skill = readFileSync(
      join(root, "node_modules/fbtee/skills/fbtee-translate/SKILL.md"),
      "utf8",
    );
    const steps = skill.split("\n").filter((l) => /^[345]\. /.test(l));
    return steps.length ? steps.join("\n") : undefined;
  } catch {
    return undefined;
  }
}

/** The translating skill, the same text Void's AI is sent (ai.ts TRANSLATING), as the app has it. */
export function translatingSkillPath(root: string): string {
  return skillPath(root).replace("skills/void-fbtee/", "skills/void-fbtee-translate/");
}

/** A few lines of the code a string is written in, around it, from fbtee's collected phrases. */
export function sourceContext(p: Project, hash: string): string | undefined {
  const phrase = (
    collect(p).phrases as {
      hashToLeaf?: Record<string, unknown>;
      filename?: string;
      loc?: { start: { line: number }; end: { line: number } };
    }[]
  ).find((ph) => ph.hashToLeaf && hash in ph.hashToLeaf);
  if (!phrase?.filename || !phrase.loc || phrase.filename.includes("node_modules")) return;
  try {
    const lines = readFileSync(join(p.root, phrase.filename), "utf8").split("\n");
    return lines.slice(Math.max(0, phrase.loc.start.line - 4), phrase.loc.end.line + 2).join("\n");
  } catch {
    return;
  }
}

// One entry per request (translateCatalog): sent three at a time, Llama 3.3 mixed their lines
// up and most failed the checks; each alone, the same entries passed (2026-11-15).
/** How many of the catalog's own translations go with each request, as examples. */
const EXAMPLES = 12;

const wordsOf = (t: string) => new Set(t.toLowerCase().match(/[a-z0-9']+/g) ?? []);
/** The names in a text: capitalised words and runs of them ("Void's AI", "Claude Code"). */
const namesOf = (t: string) =>
  new Set(t.match(/\b[A-Z][\w']*(?: [A-Z][\w']*)*/g)?.filter((n) => n.length > 1) ?? []);

/**
 * The catalog's own finished translations closest to these entries (most words in common with
 * their source and description), as examples of the app's words and style for Void's AI.
 */
export function examplesFor(
  done: CatalogEntry[],
  entries: { description: string; lines: { text: string }[] }[],
  n = EXAMPLES,
): { description: string; source: string; translation: string }[] {
  const want = wordsOf(
    entries.map((e) => e.description + " " + e.lines.map((l) => l.text).join(" ")).join(" "),
  );
  // A name the entry uses counts five times a word: the examples then show how the app already
  // writes it, so it's written the same way everywhere.
  const names = namesOf(entries.map((e) => e.lines.map((l) => l.text).join(" ")).join(" "));
  const pool = done.filter(
    (e) => e.status === "translated" && e.translations?.length === 1 && e.source,
  );
  // A word counts by how rare it is in the catalog (its inverse document frequency): "string"
  // picks the entries that show how the app says "string"; "the" and "to" pick nothing.
  const seen = new Map<string, number>();
  for (const e of pool) for (const w of wordsOf(e.source!)) seen.set(w, (seen.get(w) ?? 0) + 1);
  const weight = (w: string) => Math.log((pool.length + 1) / ((seen.get(w) ?? 0) + 1));
  return pool
    .map((e) => {
      const has = wordsOf(e.source!);
      const shared = [...namesOf(e.source!)].filter((x) => names.has(x)).length;
      const words = [...has].filter((w) => want.has(w)).reduce((a, w) => a + weight(w), 0);
      return { e, score: words + 5 * shared };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ e }) => ({
      description: e.description ?? "",
      source: e.source!,
      translation: e.translations![0]!.translation,
    }));
}

/**
 * The app's own words for the terms an entry uses: its one-word entries ("Strings", "Language")
 * and its common strings (fbtee's `common`, the app's own list of terms), when the entry uses that
 * word. Void's AI is told to use them, so a term is written the way the rest of the app writes it.
 * Longer entries ("Post them") aren't terms: asked to use them, the model tacked them on.
 */
export function glossaryFor(
  done: CatalogEntry[],
  entries: { lines: { text: string }[] }[],
  common: string[] = [],
): { source: string; translation: string }[] {
  const singular = (w: string) => w.replace(/s$/, "");
  const want = new Set(
    [...wordsOf(entries.map((e) => e.lines.map((l) => l.text).join(" ")).join(" "))].map(singular),
  );
  const terms = new Set(common);
  return done
    .filter(
      (e) =>
        e.status === "translated" &&
        e.translations?.length === 1 &&
        e.source &&
        (terms.has(e.source) || /^[A-Za-z]{4,}$/.test(e.source.trim())) &&
        [...wordsOf(e.source)].every((w) => want.has(singular(w))),
    )
    .slice(0, 20)
    .map((e) => ({ source: e.source!, translation: e.translations![0]!.translation }));
}

/** One request to the dev server's translate route (ai.ts devTranslate); undefined: no Void's AI. */
export type TranslateCall = (body: unknown) => Promise<Record<string, unknown> | undefined>;

/**
 * One string through Void's AI, as `vp dev` translates it: sent, checked (problemsWith), and asked
 * again with what was wrong, up to twice (judge.ts: problemsWith, glossaryMisses). Every problem must
 * be gone; a glossary word not used is asked about too, and accepted on the last answer. The test
 * strings go through the same (e2e/translator/). Undefined when Void's AI isn't there.
 */
export async function translateEntry(
  call: TranslateCall,
  o: {
    from: string;
    to: string;
    entry: {
      description: string;
      lines: { text: string; variations: Record<string, number> }[];
      keep?: string[];
      context?: string;
    };
    examples?: unknown[];
    glossary?: { source: string; translation: string }[];
    /** Another model than the language's own (models.ts), for trying one (e2e/translator/). */
    model?: string;
    /** The translator test turns the rules off to measure them; fbtee's own rules (fbteeRules). */
    rules?: boolean;
    fbtee?: string;
    /** AI Gateway's cache on, with this round in its key: the translator test (ai.ts ask). */
    cache?: string;
  },
): Promise<{ lines: string[]; problems: string[]; attempts: number } | undefined> {
  const source = o.entry.lines.map((l) => ({ translation: l.text, variations: l.variations }));
  const glossary = o.glossary ?? [];
  let feedback: string[] = [];
  let out: string[] = [];
  let attempts = 0;
  for (; attempts < 3;) {
    const answer = await call({
      kind: "strings",
      from: o.from,
      to: o.to,
      entries: [o.entry],
      examples: o.examples ?? [],
      glossary,
      model: o.model,
      cache: o.cache,
      rules: o.rules,
      fbtee: o.fbtee,
      feedback: feedback.length ? { answer: out, problems: feedback } : undefined,
    });
    attempts++;
    if (!answer) return;
    // Each line with its source line's own leading and trailing spaces, whatever the model added
    // (SEA-LION's Thai once began " {name} จอง…", 2026-11-15).
    out = (((answer.lines ?? []) as string[][])[0] ?? []).map((l, i) => {
      const src = source[i]?.translation ?? "";
      return src.match(/^\s*/)![0] + l.trim() + src.match(/\s*$/)![0];
    });
    const hard = problemsWith(source, out, o.to, o.from);
    const soft = glossaryMisses(glossary, out);
    feedback = [...hard, ...soft];
    if (!hard.length && (!soft.length || attempts === 3)) break;
  }
  return { lines: out, problems: problemsWith(source, out, o.to, o.from), attempts };
}

/**
 * Workers AI's limits are per model, a minute: 300 for text generation, 20 for a model that
 * requires the Workers Paid plan (models.ts perMinute; Workers AI "Limits", checked 2026-11-15).
 * Every request to the dev server's translate route takes the next free slot of its model, in
 * the order asked, kept a little under the limit (90%), rather than being refused.
 */
const slots = new Map<string, number[]>();
async function underLimit(model: TranslationModel): Promise<void> {
  const limit = Math.max(1, Math.floor(model.perMinute * 0.9));
  const taken = slots.get(model.id) ?? [];
  slots.set(model.id, taken);
  const now = Date.now();
  while (taken.length && now - taken[0]! >= 60_000) taken.shift();
  const at = Math.max(now, taken.length >= limit ? taken[taken.length - limit]! + 60_000 : now);
  taken.push(at);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/**
 * Requests to the dev server's translate route (ai.ts devTranslate), each under Workers AI's
 * per-minute limit. Undefined: Void's AI isn't there (503); an empty answer: one unusable (502).
 */
export function routeCall(url: string, token: string, log: (line: string) => void): TranslateCall {
  return async (body) => {
    // The model that answers it: the test's, or the language's (as ai.ts devTranslate picks).
    const { to, model } = body as { to?: unknown; model?: unknown };
    await underLimit(
      typeof model === "string" ? modelById(model) : typeof to === "string" ? modelFor(to) : LLAMA,
    );
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-void-fbtee-token": token },
      body: JSON.stringify(body),
    });
    if (res.status === 503) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      log(`Void's AI isn't available here (${error ?? "no answer"}), so Claude Code translates`);
      return undefined;
    }
    if (res.status === 502) {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      log(`Void's AI gave an unusable answer (${error ?? "no answer"}); left for Claude Code`);
      return {};
    }
    if (!res.ok) throw new Error(`the dev server's translate route answered ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
}

/** The translator test's: Workers AI's cache, another model, one language, the rules off. */
export interface CatalogRun {
  cache?: string;
  model?: string;
  locale?: string;
  rules?: boolean;
}

/**
 * Every new entry of one language's catalog through Void's AI, all at once: each is its own
 * request (translateEntry), so they run side by side, under Workers AI's limit (routeCall). An
 * answer that passes the checks is written into the catalog object (its lines, "translated"); the
 * file is the caller's. The examples and glossary are the catalog's finished entries as it was
 * when the run began: entries asked at the same time can't be each other's examples. Undefined
 * when Void's AI isn't there.
 */
export async function translateCatalog(
  p: Project,
  call: TranslateCall,
  locale: string,
  catalog: { translations: Record<string, CatalogEntry> },
  log: (line: string) => void,
  test: CatalogRun = {},
): Promise<{ done: number; open: number } | undefined> {
  const { texts, builtinHashes } = collect(p);
  const fbtee = fbteeRules(p.root);
  // The app's own translations, each with its source text, as examples (not written back).
  // Not fbtee's built-in strings: list joiners ("{list of items} and {last item}"), no use as
  // an example, and English where an app hasn't translated them yet.
  const finished = Object.entries(catalog.translations)
    .filter(([hash]) => !builtinHashes.has(hash))
    .map(([hash, e]) => ({ ...e, source: texts[hash] }));
  const open = Object.entries(catalog.translations).filter(
    ([, e]) => e.status === "new" && e.translations?.length,
  );
  const results = await Promise.all(
    open.map(async ([hash, entry]) => {
      const toSend = {
        description: entry.description ?? "",
        lines: entry.translations!.map((l) => ({ text: l.translation, variations: l.variations })),
        keep: [...new Set(entry.translations!.flatMap((l) => keptTerms(l.translation)))],
        context: sourceContext(p, hash),
      };
      const answer = await translateEntry(call, {
        from: p.config.sourceLocale,
        to: locale,
        entry: toSend,
        examples: examplesFor(finished, [toSend]),
        glossary: glossaryFor(finished, [toSend], Object.keys(p.common ?? {})),
        fbtee,
        ...test,
      });
      if (!answer) return;
      const out = answer.lines;
      const problems = problemsWith(entry.translations!, out, locale, p.config.sourceLocale);
      // Not kept: say what was wrong with its last answer, so the reason is in the log.
      if (problems.length) {
        log(`${texts[hash]} → ${JSON.stringify(out)}: ${problems.join(" ")}`);
        return false;
      }
      entry.translations = entry.translations!.map((l, k) => ({ ...l, translation: out[k]! }));
      entry.status = "translated";
      return true;
    }),
  );
  if (results.includes(undefined)) return;
  return { done: results.filter(Boolean).length, open: open.length };
}

/**
 * Translate what's new with Void's AI, through the dev server's own route (ai.ts devTranslate,
 * in the app's Worker): every catalog's new entries and every markdown page missing or out of
 * date, all at once (translateCatalog, routeCall). Every answer is checked as the build checks it
 * (placeholders kept; a page's kept parts, title and description), and only what passes is
 * written: an entry marked translated, a page stamped. Resolves false when Void's AI isn't there
 * (the app doesn't use `void/ai`, or no Cloudflare sign-in); what passed is still written.
 */
export async function translateWithVoidAi(
  p: Project,
  url: string,
  token: string,
  log: (line: string) => void,
  test: CatalogRun = {},
): Promise<boolean> {
  const call = routeCall(url, token, log);
  const from = p.config.sourceLocale;
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");

  const catalogs = missing(p)
    .filter((m) => !test.locale || m.locale === test.locale)
    .map(async (m) => {
      const file = catalogFile(p, m.locale);
      if (!existsSync(file)) return true;
      const catalog = JSON.parse(readFileSync(file, "utf8")) as {
        translations: Record<string, CatalogEntry>;
      };
      const ran = await translateCatalog(p, call, m.locale, catalog, log, test);
      // What passed is written even when another answer found Void's AI gone.
      writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
      if (ran?.open) log(`${rel(file)}: ${ran.done} of ${ran.open} translated with Void's AI`);
      return !!ran;
    });

  const source = sourceOf(p.config);
  const pages = markdownPages(p)
    .filter((page) => page.state === "missing" || page.state === "stale")
    .map(async (page) => {
      const original = readFileSync(page.original, "utf8");
      const answer = await call({
        kind: "page",
        from,
        to: page.locale,
        text: original,
        rules: test.rules,
      });
      if (!answer) return false;
      const copy = typeof answer.page === "string" ? answer.page : "";
      if (!copy.trim()) return true;
      const same = (a: string[], b: string[]) => a.join("\n") === b.join("\n");
      if (missingHead(original, copy).length || !same(keptParts(original), keptParts(copy))) {
        log(`${rel(page.file)}: Void's AI changed what a copy must keep; left for another way`);
        return true;
      }
      mkdirSync(dirname(page.file), { recursive: true });
      writeFileSync(page.file, copy.endsWith("\n") ? copy : copy + "\n");
      stamp(p, page.file);
      log(`${rel(page.file)}: translated with Void's AI from ${source.segment}/${page.path}`);
      return true;
    });
  return (await Promise.all([...catalogs, ...pages])).every(Boolean);
}
