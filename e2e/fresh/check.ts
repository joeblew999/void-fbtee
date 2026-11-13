// `vp run test:fresh`: void-fbtee as a developer receives it, in fresh `void init` apps, the way
// voidzero-dev/void tests its own packages before publishing (.github/workflows/prepublish-test.yml,
// .github/scripts/packed-consumer.mjs, at ee4eaa7): the package packed as npm would publish it, the
// tarball checked as Void checks its own, then installed into a new app with npm and with pnpm, on
// plain Vite and on Vite+, with a clean environment and strict settings. No local registry: Void
// needs one for packages that depend on each other by version; this is one package, so the
// tarball file is installed. Plus the git install apps use today (pnpm). Work happens in .vitest/
// (git ignores it). It installs this checkout's last commit, so commit packages/void-fbtee first.
//
// Each app also gets Void's own docs examples (e2e/fresh/app/), each checked in a language other
// than the source: what works, and, as known gaps, what doesn't yet (plans/quiet-harbor-atlas.md).
//
//   vpx e2e/fresh/check.ts                 every app
//   vpx e2e/fresh/check.ts npm-vite-plus   one (pnpm-vite-plus, npm-vite-plus, pnpm-vite,
//                                          npm-vite, git)
//
// Each app is made by `void init`, the Void version this repo pins (apps/example's), in an empty
// folder. `void init` picks the package manager from the folder (packages/void/src/cli/init.ts):
// on Vite+ pnpm unless package.json says npm (`packageManager`); on plain Vite npm unless there's a
// pnpm-workspace.yaml.
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
import { parseAst } from "vite";

const root = resolve(import.meta.dirname, "../..");
const pkgDir = join(root, "packages/void-fbtee");
// The example's languages, from its voidFbtee() (e2e/locales.ts).
const { TRANSLATED } = await import("../locales");
const work = join(root, ".vitest");

type Pm = "npm" | "pnpm";
type App = {
  pm: Pm;
  toolchain: "vite" | "vite-plus";
  /** The packed tarball, or the git dependency apps use today (a shorter check). */
  source: "tarball" | "git";
  port: number;
};
const APPS: Record<string, App> = {
  "pnpm-vite-plus": { pm: "pnpm", toolchain: "vite-plus", source: "tarball", port: 5274 },
  "npm-vite-plus": { pm: "npm", toolchain: "vite-plus", source: "tarball", port: 5276 },
  "pnpm-vite": { pm: "pnpm", toolchain: "vite", source: "tarball", port: 5275 },
  "npm-vite": { pm: "npm", toolchain: "vite", source: "tarball", port: 5277 },
  git: { pm: "pnpm", toolchain: "vite-plus", source: "git", port: 5278 },
};
const targets = process.argv[2] ? [process.argv[2]] : Object.keys(APPS);

// The builds `void init` allows on Vite+ (its pnpm-workspace.yaml), for the plain-Vite pnpm app too.
const VOID_INIT_BUILDS = { "better-sqlite3": false, esbuild: true, sharp: true, workerd: true };
const VOID = join(root, "apps/example/node_modules/.bin/void");
const VOID_INIT = ["init", "--framework", "react", "--starter", "static", "--deploy", "none"];

// A clean environment, as Void's: no tokens, logins or tool settings of this machine's.
const env: NodeJS.ProcessEnv = { ...process.env, CI: "true" };
for (const key of Object.keys(env))
  if (/^(VOID_|VP_|CLOUDFLARE_|CF_|WRANGLER_|NPM_TOKEN$|NODE_AUTH_TOKEN$)/i.test(key))
    delete env[key];

const run = (cmd: string, args: string[], cwd: string, options: { capture?: boolean } = {}) => {
  console.error(`\n$ (${cwd.replace(root, ".")}) ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd,
    env,
    stdio: ["ignore", options.capture ? "pipe" : 2, 2],
    encoding: "utf8",
  });
};
/** A command expected to fail: its output, or "" if it didn't fail. */
const failing = (cmd: string, args: string[], cwd: string) => {
  try {
    execFileSync(cmd, args, { cwd, env, encoding: "utf8", stdio: "pipe" });
    return "";
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout}${e.stderr}` || "failed";
  }
};
const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`fresh check failed: ${what}`);
  console.error(`✓ ${what}`);
};
/**
 * Something that doesn't work yet in a fresh app: a gap in plans/quiet-harbor-atlas.md, at the
 * step that fixes it. It must still fail; once it works, this stops the run, so the step that
 * fixed it turns it into a check().
 */
const gap = (ok: unknown, what: string, step: number) => {
  if (ok) throw new Error(`fresh check: works now, make it a check(): ${what}`);
  console.error(`✗ known gap (plans/quiet-harbor-atlas.md, step ${step}): ${what}`);
};
const exec = (pm: Pm, ...args: string[]): [Pm, string[]] => [pm, ["exec", "--", ...args]];
// These installs follow edits to package.json, as on a developer's machine; under CI (set, as in
// GitHub Actions) pnpm would otherwise refuse to update the lockfile.
const install = (pm: Pm): [Pm, string[]] => [
  pm,
  pm === "pnpm" ? ["install", "--no-frozen-lockfile"] : ["install"],
];

const pending = execFileSync("git", ["status", "--porcelain", "packages/void-fbtee"], {
  cwd: root,
  encoding: "utf8",
});
if (pending.trim())
  throw new Error(`commit packages/void-fbtee first; this installs the last commit:\n${pending}`);
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const repo = `git+file://${root}`;

// The package as npm would publish it, packed once (pnpm, which writes the catalog's versions in).
const packDir = join(work, "fresh-pack");
const tarball = targets.some((t) => APPS[t]?.source === "tarball") ? pack() : "";

for (const target of targets) {
  const app = APPS[target];
  if (!app) throw new Error(`usage: vpx e2e/fresh/check.ts [${Object.keys(APPS).join("|")}]`);
  const dir = join(work, `fresh-${target}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Its own git repo, as a real app is: tools that honour .gitignore (Oxlint) would otherwise
  // skip it, since this repo ignores .vitest/.
  run("git", ["init", "--quiet"], dir);
  if (app.toolchain === "vite" && app.pm === "pnpm") allowBuild(dir);
  if (app.toolchain === "vite-plus" && app.pm === "npm")
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: target, private: true, packageManager: `npm@${npmVersion()}` }) + "\n",
    );
  run(VOID, [...VOID_INIT, "--toolchain", app.toolchain], dir);
  check(
    existsSync(join(dir, app.pm === "npm" ? "package-lock.json" : "pnpm-lock.yaml")),
    `${target}: void init made a ${app.pm} app`,
  );
  strict(dir, app.pm);

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (app.source === "git") {
    allowBuild(dir, `void-fbtee@${repo}`);
    pkg.dependencies["void-fbtee"] = `${repo}#${sha}&path:/packages/void-fbtee`;
  } else pkg.dependencies["void-fbtee"] = `file:${tarball}`;
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  run(...install(app.pm), dir);
  // Formatted as a Vite+ developer would first (void init's own output isn't, under Vite+ 1.6:
  // package.json, pages/style.css, tsconfig.json, vite.config.ts, void.config.ts), so anything
  // unformatted after void-fbtee init is void-fbtee's.
  if (app.toolchain === "vite-plus") run(...exec(app.pm, "vp", "fmt"), dir);

  const installed = realpathSync(join(dir, "node_modules/void-fbtee"));
  check(
    run(...exec(app.pm, "void-fbtee", "--help"), dir, { capture: true }).includes("translate"),
    `${target}: void-fbtee --help`,
  );
  // The example's languages (its translations are copied in below); init adds the plugin,
  // middleware, flags, scripts and peers.
  run(...exec(app.pm, "void-fbtee", "init", "--locales", TRANSLATED.join(",")), dir);
  run(...install(app.pm), dir);
  // void-fbtee's own pages and Void's docs examples (e2e/fresh/app/: pages/, routes/), and the
  // example's translations of their strings. Zod for the form's validator, as Void's docs leave
  // the library to the developer (guide/server-routing.md, "Manual validators").
  cpSync(join(import.meta.dirname, "app"), dir, { recursive: true });
  cpSync(join(root, "apps/example/i18n"), join(dir, "i18n"), { recursive: true });
  run(app.pm, app.pm === "npm" ? ["install", "zod"] : ["add", "zod", "--no-frozen-lockfile"], dir);
  checkOwnDependencies(target, dir, installed);

  run(...exec(app.pm, "void-fbtee", "check"), dir);
  check(true, `${target}: void-fbtee check passes`);
  run(...exec(app.pm, app.toolchain === "vite-plus" ? "vp" : "vite", "build"), dir);
  run(...exec(app.pm, "tsc", "--noEmit"), dir);
  check(true, `${target}: builds and typechecks`);
  if (app.source === "git") continue;

  checkTypes(target, dir, app.pm);
  if (app.toolchain === "vite-plus") {
    checkLint(target, dir, app.pm);
    checkFormatting(target, dir, app.pm);
  }
  await checkDev(target, dir, app);
  if (target === "npm-vite-plus") checkMacLockfile(target, dir);
}

/** The package as npm would publish it, checked as Void checks its own (packed-registry.mjs,
 * inspectPackage), plus: only what it should hold, and every export and the command in it. */
function pack(): string {
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  run("pnpm", ["pack", "--pack-destination", packDir], pkgDir);
  const file = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  if (!file) throw new Error("pnpm pack made no tarball");
  const tgz = join(packDir, file);
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", tgz, "package/package.json"], { encoding: "utf8" }),
  );
  const files = execFileSync("tar", ["-tf", tgz], { encoding: "utf8" }).trim().split("\n");
  const https = (u: unknown) => typeof u === "string" && u.startsWith("https://");
  check(manifest.description?.trim(), "tarball: a description");
  check(manifest.license === "MIT", "tarball: MIT license");
  check(https(manifest.homepage) && https(manifest.bugs?.url), "tarball: https homepage and bugs");
  // tsdown lists any package it copied into the build here (code or types).
  check(!manifest.inlinedDependencies, "tarball: no other package copied into it");
  check(files.includes("package/LICENSE"), "tarball: LICENSE");
  check(files.includes("package/README.md"), "tarball: README.md");
  const unpacked = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]
    .flatMap((f) => Object.entries((manifest[f] ?? {}) as Record<string, string>))
    .filter(([, v]) => /^(workspace:|catalog:|link:|file:)/.test(v));
  check(!unpacked.length, `tarball: no workspace or catalog versions ${unpacked.join(" ")}`);
  const stray = files.filter(
    (f) => !/^package\/(dist\/|skills\/|README\.md$|LICENSE$|package\.json$)/.test(f),
  );
  check(!stray.length, `tarball: only dist, skills, README.md, LICENSE ${stray.join(" ")}`);
  const targetsOf = (v: unknown): string[] =>
    typeof v === "string" ? [v] : Object.values((v ?? {}) as object).flatMap(targetsOf);
  const missing = [
    ...targetsOf(manifest.exports),
    ...Object.values((manifest.bin ?? {}) as Record<string, string>),
  ]
    .map((p) => `package/${p.replace(/^\.\//, "")}`)
    .filter((p) => !files.includes(p));
  check(!missing.length, `tarball: every export and the command is in it ${missing.join(" ")}`);
  return tgz;
}

/** Strict settings, as Void's: engines must match, and (pnpm) peers must be met. */
function strict(dir: string, pm: Pm) {
  if (pm === "npm") {
    writeFileSync(join(dir, ".npmrc"), "engine-strict=true\naudit=false\nfund=false\n");
    return;
  }
  const file = join(dir, "pnpm-workspace.yaml");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  // One known gap, allowed by name so any other unmet peer still fails: fbtee's lint plugin
  // (which init adds on Vite+) uses typescript-eslint, whose packages want TypeScript below 6.1,
  // and a new Void app has TypeScript 7 (typescript-eslint#12518; it waits on TypeScript 7.1's
  // API). The rules work: checkLint runs one.
  const ts7 = ["utils", "typescript-estree", "project-service", "tsconfig-utils"].map(
    (p) => `    "@typescript-eslint/${p}>typescript": "7"`,
  );
  // Into the block `void init` writes on Vite+ (for vite: "*"), or a new one.
  const block = "peerDependencyRules:\n  allowedVersions:\n";
  const rules = text.includes(block)
    ? text.replace(block, `${block}${ts7.join("\n")}\n`)
    : `${text.trimEnd()}\n${block}${ts7.join("\n")}\n`;
  writeFileSync(file, `${rules.trimEnd()}\nstrictPeerDependencies: true\nengineStrict: true\n`);
}

function npmVersion(): string {
  return execFileSync("npm", ["--version"], { env, encoding: "utf8" }).trim();
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

/** The modules a file imports: import and export-from statements, and import() with a string. */
function importsOf(code: string): string[] {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as { type?: string; source?: { type?: string; value?: unknown } };
    if (
      (n.type === "ImportDeclaration" ||
        n.type === "ExportNamedDeclaration" ||
        n.type === "ExportAllDeclaration" ||
        n.type === "ImportExpression") &&
      n.source?.type === "Literal" &&
      typeof n.source.value === "string"
    )
      found.push(n.source.value);
    for (const value of Object.values(n)) walk(value);
  };
  walk(parseAst(code));
  return found;
}

/** Every package void-fbtee's built code imports resolves inside the app (not in this repo's). */
function checkOwnDependencies(target: string, dir: string, installed: string) {
  const specifiers = new Set<string>();
  // Real imports only, read by Vite's own parser: the plugin also holds code it writes into an app
  // (`export { default } from "@void/md/pages"`, only when the app has @void/md), which is text in
  // a string, not an import of the package's.
  for (const f of readdirSync(join(installed, "dist")).filter((f) => f.endsWith(".mjs")))
    for (const spec of importsOf(readFileSync(join(installed, "dist", f), "utf8")))
      if (!spec.startsWith(".")) specifiers.add(spec);
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
    const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
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
    `${target}: void-fbtee's ${specifiers.size} imports resolve inside the app ${outside.join(", ")}`,
  );
}

/** Void's typed routes and void-fbtee's languages in a new app, as in the example: a link to a page
 * that exists type-checks; a missing page, and a language the app hasn't, don't. */
function checkTypes(target: string, dir: string, pm: Pm) {
  const probe = join(dir, "src/_TypesProbe.ts");
  const write = (body: string) =>
    writeFileSync(
      probe,
      `import { routeUrl } from "void/routes";\nimport type { Lang } from "void-fbtee/locales";\n${body}\n`,
    );
  const tsc = () => failing(...exec(pm, "tsc", "--noEmit"), dir);
  write(`export const home = routeUrl("/[lang]", { params: { lang: "th-TH" satisfies Lang } });`);
  check(!tsc(), `${target}: a link to a page that exists type-checks`);
  write(`export const bad = routeUrl("/[lang]/no-such-page", { params: { lang: "th-TH" } });`);
  check(tsc().includes("_TypesProbe"), `${target}: a link to a missing page fails the type check`);
  write(`export const lang: Lang = "xx-XX";\nexport const u = routeUrl;`);
  check(tsc().includes("_TypesProbe"), `${target}: a language the app hasn't fails the type check`);
  // Parts of the package the plan adds (plans/quiet-harbor-atlas.md), by the names it gives them;
  // the step that builds one can rename it here, and turns its probe into a check of what it does.
  const missing = (body: string) => {
    writeFileSync(probe, `${body}\n`);
    return !tsc();
  };
  gap(
    missing(
      `import { routeUrl } from "void-fbtee/routes";\nexport const home = routeUrl("/[lang]");`,
    ),
    `${target}: a link in the page's own language needs no lang`,
    3,
  );
  gap(
    missing(`import { revalidate } from "void-fbtee/server";
export const clear = () => revalidate({ paths: ["/"] });`),
    `${target}: revalidate() clears a page in every language`,
    3,
  );
  rmSync(probe);
}

/** init's lint wiring, in Vite+ itself: the example passes, a showCount="no" probe fails. */
function checkLint(target: string, dir: string, pm: Pm) {
  run(...exec(pm, "vp", "lint", "pages"), dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  const probe = join(dir, "components/_LintProbe.tsx");
  writeFileSync(
    probe,
    `import { fbt } from "fbtee";\nexport const Probe = ({ n }: { n: number }) => (\n  <fbt desc="Lint probe: a count of nights">\n    <fbt:plural count={n} many="nights" showCount="no">night</fbt:plural>\n  </fbt>\n);\n`,
  );
  const output = failing(...exec(pm, "vp", "lint", "components/_LintProbe.tsx"), dir);
  rmSync(probe);
  check(
    output.includes("void-fbtee(no-show-count-no)"),
    `${target}: vp lint reports void-fbtee(no-show-count-no)`,
  );
}

/** After void-fbtee init, `vp fmt --check` (what `vp check` runs first) is clean: nothing init
 * wrote or changed fails a Vite+ developer's `vp check`. */
function checkFormatting(target: string, dir: string, pm: Pm) {
  const out = failing(...exec(pm, "vp", "fmt", "--check"), dir);
  const files = [...out.matchAll(/^(\S+) \(\d+ms\)$/gm)].map((m) => m[1]!).sort();
  check(!files.length, `${target}: everything init wrote is formatted ${files.join(", ")}`);
}

/** The dev server: translated pages, Void's docs examples in Thai (and the known gaps), an Arabic
 * page right-to-left, "/" to the source language, and a language the app hasn't not found. */
async function checkDev(target: string, dir: string, app: App) {
  const cli = app.toolchain === "vite-plus" ? "vp" : "vite";
  const server = spawn(
    app.pm,
    ["exec", "--", cli, "dev", "--port", String(app.port), "--strictPort"],
    { cwd: dir, env, stdio: ["ignore", "ignore", "inherit"], detached: true },
  );
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
    // Void's docs examples (e2e/fresh/app/), each in a language other than the source.
    check(
      html?.includes("<title>i18n สำหรับแอป Void</title>"),
      `${target}: head() from Void's docs gives the title in Thai`,
    );
    check(
      html?.includes('data-testid="loader-locale">th-TH<'),
      `${target}: a loader from Void's docs has the page's language`,
    );
    const thai = /[฀-๿]/;
    const form = await fetch(`${base}/th-TH/form`, {
      method: "POST",
      // As useForm sends it (@void/react).
      headers: { "Content-Type": "application/json", "X-VoidPages": "true" },
      body: JSON.stringify({ name: "" }),
    });
    const errors =
      form.status === 422 ? ((await form.json()) as { errors?: { name?: string } }) : {};
    gap(
      thai.test(errors.errors?.name ?? ""),
      `${target}: a form from Void's docs shows its validation error in Thai (got "${errors.errors?.name}")`,
      4,
    );
    const nothing = await fetch(`${base}/th-TH/no-such-page`);
    const nothingHtml = await nothing.text();
    gap(
      nothing.status === 404 && nothingHtml.includes("ไม่มีอะไรอยู่ที่นี่"),
      `${target}: an address with nothing at it gets a not-found page in Thai`,
      5,
    );
    const sitemap = await fetch(`${base}/sitemap.xml`);
    gap(
      sitemap.ok && (await sitemap.text()).includes('hreflang="th-TH"'),
      `${target}: /sitemap.xml lists every page in every language`,
      6,
    );
    // Void's scheduled job example (crons/hourly-heartbeat.ts), run as Void's docs say to locally
    // (guide/jobs.md, "Local development"), with the token Void keeps in .void/. The job throws
    // unless inLocale() gave it Thai, and Void reports a job that throws.
    const token = readFileSync(join(dir, ".void/dev-trigger-token"), "utf8").trim();
    const job = await fetch(`${base}/__void/scheduled`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-void-dev-trigger": token },
      body: JSON.stringify({ cron: "0 * * * *", scheduledTime: Date.now() }),
    });
    const ran = await job.text();
    check(
      job.ok && JSON.parse(ran).ok === true,
      `${target}: a scheduled job from Void's docs translates with inLocale(), with no request ${ran}`,
    );
    const api = await fetch(`${base}/api/hello`, { headers: { "Accept-Language": "th-TH" } });
    const hello = (await api.json()) as { locale?: string; message?: string };
    gap(
      hello.locale === "th-TH" && thai.test(hello.message ?? ""),
      `${target}: a server route from Void's docs answers in the language asked for (got ${hello.locale})`,
      10,
    );
    const ar = await (await fetch(`${base}/ar-EG`)).text();
    check(
      ar.includes('<html lang="ar-EG" dir="rtl"') && ar.includes("تدويل تطبيقات Void"),
      `${target}: dev serves /ar-EG right-to-left, in Arabic`,
    );
    const home = await fetch(`${base}/`, { redirect: "manual" });
    check(
      home.status === 301 && home.headers.get("location")?.endsWith("/en-US"),
      `${target}: "/" redirects to /en-US (301)`,
    );
    const madeUp = await fetch(`${base}/xx-XX`, { redirect: "manual" });
    check(madeUp.status === 404, `${target}: a language the app hasn't (/xx-XX) is not found`);
  } finally {
    if (server.pid) process.kill(-server.pid, "SIGTERM");
  }
}

/**
 * A Mac developer with Linux CI, on npm: the lockfile is written as on a Mac (npm's --os/--cpu),
 * including a later install with node_modules present (where npm/cli#4828 drops other systems'
 * builds of native packages), then `npm ci` and a build here. fbtee's compiler is native code, one
 * build per system (@nkzw/oxc-transform-fbtee-binding-*).
 */
function checkMacLockfile(target: string, dir: string) {
  // Only the lockfile a Mac writes: install scripts (workerd's checks its build) run on the Mac,
  // against its own builds, so not here. `npm ci` below runs them, as Linux CI does.
  const mac = ["--os=darwin", "--cpu=arm64", "--ignore-scripts"];
  rmSync(join(dir, "node_modules"), { recursive: true, force: true });
  rmSync(join(dir, "package-lock.json"), { force: true });
  run("npm", ["install", ...mac], dir);
  run("npm", ["install", ...mac, "ms@2.1.3"], dir);
  rmSync(join(dir, "node_modules"), { recursive: true, force: true });
  const ci = failing("npm", ["ci"], dir);
  check(
    !ci,
    `${target}: npm ci with a lockfile made on a Mac ${ci.split("\n").slice(-3).join(" ")}`,
  );
  const build = failing(...exec("npm", "vp", "build"), dir);
  check(!build, `${target}: and it builds ${build.split("\n").slice(-5).join(" ")}`);
}
