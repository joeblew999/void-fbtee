#!/usr/bin/env node
// The void-fbtee command. Run it in the app's folder, where vite.config.ts is.
//
//   void-fbtee prepare   write each locale's catalog: new strings marked "new", finished ones kept
//   void-fbtee check     list what's missing or wrong; exits 1 if anything is
//   void-fbtee init      wire void-fbtee into a `void init` app
//   void-fbtee translate prepare, then a coding agent (claude) translates what's missing
//   void-fbtee stamp     record which version of the original a translated page is from
//
// It reads the app's locales from the voidFbtee() call in vite.config.ts, through Vite's own
// config loader, so there's no second config.
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { formatMissing, missing } from "./catalogs";
import { check } from "./check";
import { loadProject, prepare } from "./commands";
import { init } from "./init";
import {
  AGENT_TOOLS,
  hasClaude,
  insideClaudeCode,
  runClaude,
  runner,
  stamp,
  translateTask,
} from "./translate";

const USAGE = `Usage: void-fbtee <command> [--root <dir>] [files...]

Commands:
  init      Wire void-fbtee into a \`void init\` app: the Vite plugin, the middleware, the
            layout's <I18nProvider>, Cloudflare's temporal flag, tsconfig, scripts, lint
            rules (Vite+) and AGENTS.md. Only adds what's missing; safe to run again.
  prepare   Write each locale's catalog in i18n/translations/: new strings are added and
            marked "status": "new", finished translations are kept, strings no longer in
            the code are removed.
  check     List what's missing or wrong: setup, Cloudflare's temporal flag, untranslated
            strings, markdown pages not translated or out of date. Exits 1 if anything is.
  translate Run prepare, then hand what's untranslated to Claude Code (\`claude -p\`) with
            void-fbtee's skill. Claude may only read and edit files. Then records each
            translated page's translatedFrom and runs check. Review the result with git diff.
            Doesn't run in CI. Without claude installed, prints the prompt for any agent.
  stamp     Record in each translated page given (pages/<locale>/...md) which version of
            its original it was translated from (translatedFrom), after translating by hand.

Options:
  --root <dir>              The app's folder (default: the current folder).
  --source-locale <locale>  init: the language the code is written in (default en-US).
  --locales <list>          init: comma-separated locales, source first (default: the source only).
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      "source-locale": { type: "string" },
      locales: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    return;
  }
  const root = values.root ?? process.cwd();
  if (command === "init") {
    // Runs before the plugin is in the config, so it doesn't load the project.
    const sourceLocale = values["source-locale"] ?? "en-US";
    const rest = (values.locales ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const locales = [sourceLocale, ...rest.filter((l) => l !== sourceLocale)];
    const { done, todo } = await init({ root, sourceLocale, locales });
    for (const line of done) console.log(`✓ ${line}`);
    if (!done.length) console.log("void-fbtee is already wired in; nothing to change");
    if (todo.length) console.log("\nnext:");
    for (const line of todo) console.log(`  - ${line}`);
    return;
  }
  const p = await loadProject(root);
  if (command === "translate") await translate(p, root);
  else if (command === "stamp") {
    if (positionals.length < 2)
      throw new Error("stamp: give the translated pages, e.g. pages/th-TH/blog/hello.md");
    for (const file of positionals.slice(1)) {
      stamp(p, resolve(file));
      console.log(`stamped ${file}`);
    }
  } else if (command === "prepare") {
    for (const f of prepare(p)) console.log(`wrote ${f}`);
    const report = formatMissing(missing(p));
    console.log(report ? `untranslated strings:\n${report}` : "all strings translated");
  } else if (command === "check") {
    const problems = check(p);
    for (const line of problems) console.log(line);
    console.log(problems.length ? `${problems.length} problems` : "void-fbtee check: all good");
    process.exitCode = problems.length ? 1 : 0;
  } else {
    process.stderr.write(`void-fbtee: unknown command "${command}"\n\n${USAGE}`);
    process.exitCode = 2;
  }
}

async function translate(p: Awaited<ReturnType<typeof loadProject>>, root: string) {
  if (process.env.CI)
    throw new Error(
      "translate edits your files with a coding agent, so it doesn't run in CI. Use void-fbtee check there.",
    );
  for (const f of prepare(p)) console.log(`wrote ${f}`);
  const task = translateTask(p);
  if (!task) {
    console.log("nothing to translate");
  } else if (insideClaudeCode() || !hasClaude()) {
    // Inside Claude Code already (it sets CLAUDECODE=1 in its shell): that agent does the work.
    // A second `claude -p` started there has no sign-in of its own in a Claude cloud session, and
    // on a laptop it would be a second agent without the first one's context.
    console.log(
      (insideClaudeCode()
        ? "\nYou're running in Claude Code, so translate in this session: follow this prompt, then run\n"
        : "\nClaude Code (claude) isn't installed here. Give this prompt to your coding agent, then run\n") +
        `${runner(root)} exec void-fbtee stamp <each translated page> and void-fbtee check:\n`,
    );
    console.log(task.prompt);
    process.exitCode = 1;
    return;
  } else {
    console.log(
      `\n$ claude -p <prompt> --permission-mode acceptEdits --allowedTools ${AGENT_TOOLS.join(",")}\n`,
    );
    console.log(task.prompt.replace(/^/gm, "  > "));
    console.log("");
    const before = new Map(
      task.pages.map((page) => [
        page.file,
        existsSync(page.file) ? readFileSync(page.file, "utf8") : undefined,
      ]),
    );
    const code = await runClaude(root, task.prompt);
    if (code !== 0) console.log(`\nclaude exited with ${code}`);
    // Pages the agent wrote, and unrecorded ones it checked. An untouched stale page stays stale.
    const unrecorded = new Set(
      task.pages.filter((x) => x.state === "unrecorded").map((x) => x.file),
    );
    for (const [file, text] of before) {
      if (!existsSync(file)) continue;
      if (readFileSync(file, "utf8") === text && !(code === 0 && unrecorded.has(file))) continue;
      stamp(p, file);
      console.log(`stamped ${relative(root, file)}`);
    }
  }
  const problems = check(p);
  console.log("");
  for (const line of problems) console.log(line);
  console.log(problems.length ? `${problems.length} problems left` : "void-fbtee check: all good");
  if (problems.length) process.exitCode = 1;
}

await main().catch((error: Error) => {
  process.stderr.write(`void-fbtee: ${error.message}\n`);
  process.exitCode = 1;
});
