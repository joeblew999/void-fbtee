// `vp run test:fresh`: void-fbtee installed into fresh `void init` apps the way an app installs
// it: as a git dependency, built by pnpm (the README's two lines). It installs from this checkout's
// last commit rather than from GitHub, so commit first. Like voidzero-dev/void's packed-consumer
// smoke check, it uses no browser: the package's contents, a real `void-fbtee init`, the CLI, a
// build, TypeScript and a few requests to the dev server. Work happens in .vitest/ (git ignores it).
//
//   vpx e2e/fresh/check.ts              both apps
//   vpx e2e/fresh/check.ts vite-plus    a `void init --toolchain vite-plus` app
//   vpx e2e/fresh/check.ts vite         a `void init --toolchain vite` app
//
// Each app is made fresh by `void init`, the Void version this repo pins
// (apps/example/node_modules/.bin/void), in an empty folder, as a user starts one. Both use
// pnpm: a git dependency on a folder inside a repo (`path:`) is a pnpm feature npm doesn't have.
// The plain-Vite app gets a pnpm-workspace.yaml first, which is how `void init` picks pnpm for a
// new app (otherwise npm). There are no lockfiles in this repo; pnpm would insist on one in CI.
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
// The example's languages, from its voidFbtee() (e2e/locales.ts).
const { TRANSLATED } = await import("../locales");
const work = join(root, ".vitest");
const targets = process.argv[2] ? [process.argv[2]] : ["vite-plus", "vite"];
type App = { pm: string; install: string[]; cli: string[]; port: number };
const APPS: Record<string, App> = {
  "vite-plus": {
    pm: "pnpm",
    install: ["install", "--no-frozen-lockfile"],
    cli: ["exec", "vp"],
    port: 5274,
  },
  vite: {
    pm: "pnpm",
    install: ["install", "--no-frozen-lockfile"],
    cli: ["exec", "vite"],
    port: 5275,
  },
};
// The builds `void init` allows on Vite+ (its pnpm-workspace.yaml), for the plain-Vite app too.
const VOID_INIT_BUILDS = { "better-sqlite3": false, esbuild: true, sharp: true, workerd: true };

const VOID = join(root, "apps/example/node_modules/.bin/void");
const VOID_INIT = ["init", "--framework", "react", "--starter", "static", "--deploy", "none"];

const run = (cmd: string, args: string[], cwd: string, options: { capture?: boolean } = {}) => {
  console.error(`\n$ (${cwd.replace(root, ".")}) ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", options.capture ? "pipe" : 2, 2],
    encoding: "utf8",
  });
};
const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`fresh check failed: ${what}`);
  console.error(`✓ ${what}`);
};

// The README's two lines, pointed at this checkout's last commit instead of GitHub.
const pending = execFileSync("git", ["status", "--porcelain", "packages/void-fbtee"], {
  cwd: root,
  encoding: "utf8",
});
if (pending.trim())
  throw new Error(`commit packages/void-fbtee first; this installs the last commit:\n${pending}`);
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const repo = `git+file://${root}`;
const dependency = `${repo}#${sha}&path:/packages/void-fbtee`;

for (const target of targets) {
  const app = APPS[target];
  if (!app) throw new Error(`usage: vpx e2e/fresh/check.ts [vite-plus|vite] (got ${target})`);
  const dir = join(work, `fresh-${target}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Its own git repo, as a real app is: tools that honour .gitignore (Oxlint) would otherwise
  // skip it, since this repo ignores .vitest/.
  run("git", ["init", "--quiet"], dir);
  if (target === "vite") allowBuild(dir); // pnpm, for `void init` (see the top of this file)
  run(VOID, [...VOID_INIT, "--toolchain", target], dir);
  allowBuild(dir, `void-fbtee@${repo}`);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  pkg.dependencies["void-fbtee"] = dependency;
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  run(app.pm, app.install, dir);
  // Formatted as a Vite+ developer would first (void init's own output isn't, under Vite+ 1.6:
  // package.json, pages/style.css, tsconfig.json, vite.config.ts, void.config.ts), so anything
  // unformatted after void-fbtee init is void-fbtee's.
  if (target === "vite-plus") run("pnpm", ["exec", "vp", "fmt"], dir);

  const installed = realpathSync(join(dir, "node_modules/void-fbtee"));
  for (const f of ["dist/plugin.mjs", "dist/lint.mjs", "skills/void-fbtee/SKILL.md"])
    check(existsSync(join(installed, f)), `${target}: the package has ${f}`);
  check(
    run(app.pm, ["exec", "--", "void-fbtee", "--help"], dir, { capture: true }).includes(
      "translate",
    ),
    `${target}: void-fbtee --help`,
  );

  // The example's languages (its translations are copied in below); init adds the plugin,
  // middleware, flags, scripts and peers.
  run(app.pm, ["exec", "--", "void-fbtee", "init", "--locales", TRANSLATED.join(",")], dir);
  run(app.pm, app.install, dir);
  // void-fbtee's own pages (e2e/fresh/app/) and the example's translations of their strings.
  cpSync(join(import.meta.dirname, "app/pages"), join(dir, "pages"), { recursive: true });
  cpSync(join(root, "apps/example/i18n"), join(dir, "i18n"), { recursive: true });
  checkOwnDependencies(dir, installed);

  run(app.pm, ["exec", "--", "void-fbtee", "check"], dir);
  check(true, `${target}: void-fbtee check passes`);
  run(app.pm, [...app.cli, "build"], dir);
  run(app.pm, ["exec", "--", "tsc", "--noEmit"], dir);
  check(true, `${target}: builds and typechecks`);
  if (target === "vite-plus") {
    checkLint(dir);
    checkFormatting(target, dir);
  }
  await checkDev(target, dir, app);
}

/**
 * pnpm-workspace.yaml's allowBuilds: with `spec`, the README's line (pnpm only runs an approved
 * git dependency's build); without, the file `void init` writes on Vite+, for the plain-Vite app.
 */
function allowBuild(dir: string, spec?: string) {
  const file = join(dir, "pnpm-workspace.yaml");
  if (spec) {
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace("allowBuilds:\n", `allowBuilds:\n  "${spec}": true\n`));
  } else {
    const builds = Object.entries(VOID_INIT_BUILDS);
    writeFileSync(file, `allowBuilds:\n${builds.map(([k, v]) => `  "${k}": ${v}`).join("\n")}\n`);
  }
}

/** Every package void-fbtee's built code imports resolves inside the app (not in this repo's). */
function checkOwnDependencies(dir: string, installed: string) {
  const specifiers = new Set<string>();
  for (const f of readdirSync(join(installed, "dist")).filter((f) => f.endsWith(".mjs"))) {
    const code = readFileSync(join(installed, "dist", f), "utf8");
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*"([^".][^"]*)"/g)) specifiers.add(m[1]);
  }
  const outside: string[] = [];
  // An optional peer the app hasn't installed is left out: the part that imports it isn't loaded
  // there (vite-plus: only Vite+'s linter loads void-fbtee/lint).
  const own = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  const appPkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const optional = (name: string) =>
    own.peerDependenciesMeta?.[name]?.optional &&
    !appPkg.dependencies?.[name] &&
    !appPkg.devDependencies?.[name];
  for (const spec of specifiers) {
    if (spec.startsWith("node:") || spec.startsWith("virtual:")) continue;
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    if (optional(name)) continue;
    // Node's lookup: the first node_modules/<name> walking up from the package's folder.
    let found: string | undefined;
    for (let d = installed; !found; d = dirname(d)) {
      const candidate = join(d, "node_modules", name);
      if (existsSync(candidate)) found = realpathSync(candidate);
      if (d === dirname(d)) break;
    }
    if (!found || !found.startsWith(realpathSync(dir)))
      outside.push(`${spec} → ${found ?? "not found"}`);
  }
  check(
    !outside.length,
    `void-fbtee's ${specifiers.size} imports resolve inside the app ${outside.join(", ")}`,
  );
}

/** init's lint wiring, in Vite+ itself: the example passes, a showCount="no" probe fails. */
function checkLint(dir: string) {
  run("pnpm", ["exec", "vp", "lint", "pages"], dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  const probe = join(dir, "components/_LintProbe.tsx");
  writeFileSync(
    probe,
    `import { fbt } from "fbtee";\nexport const Probe = ({ n }: { n: number }) => (\n  <fbt desc="Lint probe: a count of nights">\n    <fbt:plural count={n} many="nights" showCount="no">night</fbt:plural>\n  </fbt>\n);\n`,
  );
  let output = "";
  try {
    execFileSync("pnpm", ["exec", "vp", "lint", "components/_LintProbe.tsx"], {
      cwd: dir,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    output = `${e.stdout}${e.stderr}`;
  }
  rmSync(probe);
  check(
    output.includes("void-fbtee(no-show-count-no)"),
    `vp lint reports void-fbtee(no-show-count-no)`,
  );
}

/** The files `vp fmt --check` (what `vp check` runs first) reports as unformatted. */
function unformatted(dir: string): string[] {
  let out = "";
  try {
    out = execFileSync("pnpm", ["exec", "vp", "fmt", "--check"], {
      cwd: dir,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    out = `${e.stdout}${e.stderr}`;
  }
  return [...out.matchAll(/^(\S+) \(\d+ms\)$/gm)].map((m) => m[1]!).sort();
}

/** After void-fbtee init, `vp fmt --check` (what `vp check` runs first) is clean: nothing init
 * wrote or changed fails a Vite+ developer's `vp check`. */
function checkFormatting(target: string, dir: string) {
  const files = unformatted(dir);
  check(!files.length, `${target}: everything init wrote is formatted ${files.join(", ")}`);
}

/** The dev server serves translated pages, and an Arabic page right-to-left. */
async function checkDev(target: string, dir: string, app: App) {
  const server = spawn(app.pm, [...app.cli, "dev", "--port", String(app.port), "--strictPort"], {
    cwd: dir,
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  const base = `http://localhost:${app.port}`;
  try {
    let html;
    for (let i = 0; i < 300 && html === undefined; i++) {
      try {
        const res = await fetch(`${base}/th-TH`);
        if (res.ok) html = await res.text();
      } catch {}
      if (html === undefined) await new Promise((r) => setTimeout(r, 100));
    }
    check(html?.includes("i18n สำหรับแอป Void"), `${target}: dev serves /th-TH in Thai`);
    const ar = await (await fetch(`${base}/ar-EG`)).text();
    check(
      ar.includes('<html lang="ar-EG" dir="rtl"') && ar.includes("تدويل تطبيقات Void"),
      `${target}: dev serves /ar-EG right-to-left, in Arabic`,
    );
  } finally {
    if (server.pid) process.kill(-server.pid, "SIGTERM");
  }
}
