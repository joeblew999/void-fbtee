// Translating, as `vp dev` does it (plugin.ts): the work goes to a coding agent, `claude -p` with
// void-fbtee's skill, allowed to read and edit files and nothing else, or the Claude Code session
// the dev server runs in, given the prompt. The skill does the translating; this file only says
// what's missing, records each translated page's original, and checks the result.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogFile, missing, type Project } from "./catalogs";
import {
  frontmatter,
  markdownHash,
  markdownPages,
  TRANSLATED_FROM,
  TRANSLATED_FROM_LINE,
  type MarkdownPage,
} from "./check";
import { sourceOf } from "./locales";
import { check } from "./check";

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
