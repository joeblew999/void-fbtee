// `vp run check:tools`: run every tool that writes setup into this repo, and fail if any of them
// changes a file. A new Vite+ or Void release that wants something different shows up here, with
// the diff. Works on an unclean checkout too: it compares the repo before and after.
//   - vp config: Vite+'s project setup (hooks, and the Vite+ section of AGENTS.md)
//   - void init --tsconfig: Void's setup step that runs without questions (tsconfig, AGENTS.md, skills)
//   - void-fbtee init: this package's own setup, on the example (it only adds what's missing)
//   - void db generate: a migration for any table change not migrated yet (there should be none)
//   - vp fmt: the formatter, so a tool's formatting isn't counted as a change
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const example = join(root, "apps/example");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const state = () => git("status", "--porcelain", "--untracked-files=all") + git("diff");
const run = (cwd, cmd, ...args) => {
  console.error(`\n$ (${cwd.replace(root, ".") || "."}) ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: ["ignore", 2, 2] });
};

const before = state();
run(root, "vp", "config");
run(example, "vp", "exec", "void", "init", "--tsconfig");
run(example, "vp", "exec", "void-fbtee", "init", "--locales", "ar-EG,th-TH");
run(example, "vp", "exec", "void", "db", "generate");
run(root, "vp", "fmt");
const after = state();
if (after !== before) {
  console.error("\nA tool changed the repo:\n" + git("status", "--short") + "\n" + git("diff"));
  process.exit(1);
}
console.error("\n✓ the tools leave the repo as it is");
