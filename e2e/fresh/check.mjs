// `pnpm run test:fresh`: void-fbtee installed from its tarball into fresh `void init` apps, as a
// user gets it. Like voidzero-dev/void's packed-consumer smoke check, it uses no browser: the
// package's contents, a real `void-fbtee init`, the CLI, a build, TypeScript and a few requests
// to the dev server. Work happens in .e2e-work/ (git ignores it).
//
//   node e2e/fresh/check.mjs              both apps
//   node e2e/fresh/check.mjs vite-plus    a `void init --toolchain vite-plus` app, with pnpm
//   node e2e/fresh/check.mjs vite         a `void init --toolchain vite` app, with npm
//
// e2e/fresh/<toolchain>/ holds what `void init` made (package.json with exact versions,
// vite.config.ts with @void/md added, void.config.ts, tsconfig.json, AGENTS.md). There are no
// lockfiles in this repo; pnpm would insist on one in CI unless told otherwise.
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
const work = join(root, ".e2e-work");
const targets = process.argv[2] ? [process.argv[2]] : ["vite-plus", "vite"];
const APPS = {
  "vite-plus": {
    pm: "pnpm",
    install: ["install", "--no-frozen-lockfile"],
    cli: ["exec", "vp"],
    port: 5274,
  },
  vite: { pm: "npm", install: ["install"], cli: ["exec", "--", "vite"], port: 5275 },
};

const run = (cmd, args, cwd, options = {}) => {
  console.error(`\n$ (${cwd.replace(root, ".")}) ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", options.capture ? "pipe" : 2, 2],
    encoding: "utf8",
  });
};
const check = (ok, what) => {
  if (!ok) throw new Error(`fresh check failed: ${what}`);
  console.error(`✓ ${what}`);
};

// The tarball, once.
const pkgDir = join(work, "pkg");
rmSync(pkgDir, { recursive: true, force: true });
mkdirSync(pkgDir, { recursive: true });
run("pnpm", ["exec", "vp", "pack"], join(root, "packages/void-fbtee"));
run("pnpm", ["pack", "--pack-destination", pkgDir], join(root, "packages/void-fbtee"));
const tarball = join(
  pkgDir,
  readdirSync(pkgDir).find((f) => f.endsWith(".tgz")),
);

for (const target of targets) {
  const app = APPS[target];
  if (!app) throw new Error(`usage: node e2e/fresh/check.mjs [vite-plus|vite] (got ${target})`);
  const dir = join(work, `fresh-${target}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(root, "e2e/fresh", target), dir, { recursive: true });
  // Its own git repo, as a real app is: tools that honour .gitignore (Oxlint) would otherwise
  // skip it, since this repo ignores .e2e-work/.
  run("git", ["init", "--quiet"], dir);
  run(app.pm, app.install, dir);
  run(app.pm, target === "vite-plus" ? ["add", tarball] : ["install", tarball], dir);

  const installed = realpathSync(join(dir, "node_modules/void-fbtee"));
  for (const f of [
    "dist/vite.mjs",
    "dist/lint.mjs",
    "skills/void-fbtee/SKILL.md",
    "docs/strings.md",
  ])
    check(existsSync(join(installed, f)), `${target}: the package has ${f}`);
  check(
    run(app.pm, ["exec", "--", "void-fbtee", "--help"], dir, { capture: true }).includes(
      "translate",
    ),
    `${target}: void-fbtee --help`,
  );

  // The example's locales; init adds the plugin, middleware, flags, scripts and peers.
  run(app.pm, ["exec", "--", "void-fbtee", "init", "--locales", "th-TH,de-DE,ar-EG,pl-PL"], dir);
  run(app.pm, app.install, dir);
  for (const item of ["pages", "components", "routes", "lib", "i18n", "db", "public"])
    cpSync(join(root, "apps/example", item), join(dir, item), { recursive: true });
  checkOwnDependencies(dir, installed);

  run(app.pm, ["exec", "--", "void-fbtee", "check"], dir);
  check(true, `${target}: void-fbtee check passes`);
  run(app.pm, [...app.cli, "build"], dir);
  run(app.pm, ["exec", "--", "tsc", "--noEmit"], dir);
  check(true, `${target}: builds and typechecks`);
  if (target === "vite-plus") checkLint(dir);
  await checkDev(target, dir, app);
}

/** Every package void-fbtee's built code imports resolves inside the app (not in this repo's). */
function checkOwnDependencies(dir, installed) {
  const specifiers = new Set();
  for (const f of readdirSync(join(installed, "dist")).filter((f) => f.endsWith(".mjs"))) {
    const code = readFileSync(join(installed, "dist", f), "utf8");
    for (const m of code.matchAll(/(?:from|import)\s*\(?\s*"([^".][^"]*)"/g)) specifiers.add(m[1]);
  }
  const outside = [];
  for (const spec of specifiers) {
    if (spec.startsWith("node:") || spec.startsWith("virtual:")) continue;
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
    // Node's lookup: the first node_modules/<name> walking up from the package's folder.
    let found;
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
function checkLint(dir) {
  run("pnpm", ["exec", "vp", "lint", "pages", "components"], dir);
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
    output = `${error.stdout}${error.stderr}`;
  }
  rmSync(probe);
  check(
    output.includes("void-fbtee(no-show-count-no)"),
    `vp lint reports void-fbtee(no-show-count-no)`,
  );
}

/** The dev server serves translated pages, and an Arabic page right-to-left. */
async function checkDev(target, dir, app) {
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
    check(html?.includes("สวัสดีชาวโลก"), `${target}: dev serves /th-TH in Thai`);
    const ar = await (await fetch(`${base}/ar-EG/about`)).text();
    check(
      ar.includes('<html lang="ar-EG" dir="rtl"') && ar.includes("احجز مقعدًا"),
      `${target}: dev serves /ar-EG right-to-left, in Arabic`,
    );
  } finally {
    if (server.pid) process.kill(-server.pid, "SIGTERM");
  }
}
