// Sets up one app for `pnpm run e2e:fresh`, in .e2e-work/ (git ignores it). Playwright runs this
// before starting the app's servers.
//
//   node e2e/fresh/prepare.mjs vite-plus   a `void init --toolchain vite-plus` app (pnpm)
//   node e2e/fresh/prepare.mjs vite        a `void init --toolchain vite` app (npm)
//   node e2e/fresh/prepare.mjs clone       a fresh `git clone` of this repo (last commit)
//
// The two init apps: e2e/fresh/<toolchain>/ holds what `void init` made (package.json with
// exact versions). The test installs them, adds void-fbtee from the tarball `pnpm pack` makes,
// and copies in the example's app code (pages, middleware, config), so both apps run the same
// pages the specs check. There are no lockfiles in this repo; pnpm would insist on one in CI
// unless told otherwise, hence --no-frozen-lockfile.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const work = join(root, ".e2e-work");
const target = process.argv[2];

const run = (cmd, args, cwd) => {
  console.error(`\n$ (${cwd.replace(root, ".")}) ${cmd} ${args.join(" ")}`);
  // Output to stderr: Playwright shows a server command's stderr, and its stdout is quiet.
  execFileSync(cmd, args, { cwd, stdio: ["ignore", 2, 2] });
};

if (target === "clone") {
  const dir = join(work, "clone");
  rmSync(dir, { recursive: true, force: true });
  run("git", ["clone", "--quiet", root, dir], root);
  // A first install builds the package's dist/ ("prepare"), which isn't in git.
  run("pnpm", ["install", "--no-frozen-lockfile"], dir);
  if (!existsSync(join(dir, "packages/void-fbtee/dist/vite.mjs")))
    throw new Error("pnpm install in a fresh clone didn't build packages/void-fbtee/dist");
} else if (target === "vite-plus" || target === "vite") {
  const pkg = join(work, "pkg");
  rmSync(pkg, { recursive: true, force: true });
  mkdirSync(pkg, { recursive: true });
  run("pnpm", ["exec", "vp", "pack"], join(root, "packages/void-fbtee"));
  run("pnpm", ["pack", "--pack-destination", pkg], join(root, "packages/void-fbtee"));
  const tarball = join(
    pkg,
    readdirSync(pkg).find((f) => f.endsWith(".tgz")),
  );

  const dir = join(work, `fresh-${target}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(root, "e2e/fresh", target), dir, { recursive: true });
  const example = join(root, "apps/example");
  for (const item of [
    "vite.config.ts",
    "void.config.ts",
    "middleware",
    "pages",
    "components",
    "routes",
    "lib",
    "i18n",
    "db",
    "public",
  ])
    cpSync(join(example, item), join(dir, item), { recursive: true });

  if (target === "vite-plus") {
    run("pnpm", ["install", "--no-frozen-lockfile"], dir);
    run("pnpm", ["add", tarball], dir);
  } else {
    run("npm", ["install"], dir);
    run("npm", ["install", tarball], dir);
  }
  checkOwnDependencies(dir);
} else {
  throw new Error(`usage: node e2e/fresh/prepare.mjs vite-plus|vite|clone (got ${target})`);
}

/**
 * The fresh app sits inside this repo, so Node would also find packages in the repo root's
 * node_modules. Every package void-fbtee's built code imports must resolve inside the app.
 */
function checkOwnDependencies(dir) {
  // From the package's real location, as Node resolves its imports (pnpm links it in).
  const pkgDir = realpathSync(join(dir, "node_modules/void-fbtee"));
  const specifiers = new Set();
  for (const f of readdirSync(join(pkgDir, "dist")).filter((f) => f.endsWith(".mjs"))) {
    const code = readFileSync(join(pkgDir, "dist", f), "utf8");
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*"([^".][^"]*)"/g)) specifiers.add(m[1]);
  }
  const outside = [];
  for (const spec of specifiers) {
    if (spec.startsWith("node:") || spec.startsWith("virtual:")) continue;
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    // Node's lookup: the first node_modules/<name> walking up from the package's folder.
    let found;
    for (let d = pkgDir; !found; d = dirname(d)) {
      const candidate = join(d, "node_modules", name);
      if (existsSync(candidate)) found = realpathSync(candidate);
      if (d === dirname(d)) break;
    }
    if (!found || !found.startsWith(realpathSync(dir)))
      outside.push(`${spec} → ${found ?? "not found"}`);
  }
  if (outside.length)
    throw new Error(`void-fbtee's imports not found inside ${dir}:\n  ${outside.join("\n  ")}`);
  console.error(`\nvoid-fbtee imports ${specifiers.size} modules; all resolve inside the app`);
}
