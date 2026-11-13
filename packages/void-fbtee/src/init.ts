// `void-fbtee init`: wires void-fbtee into a `void init` app. Each step only
// adds what's missing, so running it twice changes nothing. Where it can't edit a file safely it
// prints the exact lines to add instead of guessing. Config files are edited with magicast.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { builders, generateCode, loadFile, type ProxifiedModule } from "magicast";
import { addVitePlugin, getDefaultExportOptions } from "magicast/helpers";
import { DEFAULT_TRANSLATIONS } from "./catalogs";
import { checkSite } from "./site";
import { packageManager } from "./translate";

export interface InitOptions {
  root: string;
  sourceLocale: string;
  locales: string[];
  /** The site's own address, for voidFbtee({ site }); checked as the plugin checks it. */
  site?: string;
}

export interface InitResult {
  /** What init changed, one line each. */
  done: string[];
  /** What the person must do by hand, one line each (with the exact text to add). */
  todo: string[];
}

const SKILL = "node_modules/void-fbtee/skills/void-fbtee/SKILL.md";
const AGENTS_START = "<!--injected-by-void-fbtee-->";
const AGENTS_END = "<!--/injected-by-void-fbtee-->";
const AGENTS_BLOCK = `${AGENTS_START}
## void-fbtee (i18n)

- This app is translated with [void-fbtee](https://github.com/joeblew999/void-fbtee): fbtee strings, Temporal dates, Intl formatting.
- For anything about translations, read \`${SKILL}\` first.
- To translate new strings and pages, run the \`i18n:translate\` script (or ask: "translate the app"). To see what's missing, run \`i18n:check\`.

${AGENTS_END}`;

const LAYOUT = `// The i18n provider sits above every page: <fbt> runs during each page's own render.
import type { ReactNode } from "react";
import { I18nProvider } from "void-fbtee/react";

export default function Layout({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
`;

/**
 * The app's languages, once: vite.config.ts gives this list to voidFbtee(), and its type to
 * void-fbtee's (Register), so a link built from the page's language is checked by Void's typed
 * routes.
 */
const localesFile = (
  sourceLocale: string,
  locales: string[],
) => `// The app's languages, once: voidFbtee() in vite.config.ts gets this list, and the type below gives
// the same list to void-fbtee's types, so a link built from the page's language is checked by Void's
// typed routes (\`/\${lang}/docs/tour\` must be a real page in every language).
export const sourceLocale = ${JSON.stringify(sourceLocale)};
export const locales = [${locales.map((l) => JSON.stringify(l)).join(", ")}] as const;

declare global {
  interface VoidFbteeRegister {
    locales: typeof locales;
  }
}
`;

const MIDDLEWARE = `// Locale from the URL, fbtee's per-request state, <html lang dir>. 99 so Void runs it after the
// app's own middleware (01.auth.ts and the like): it adds to the shared and head data they set.
export { default } from "void-fbtee/middleware";
`;

// Void's not-found and error pages (pages/_not-found.tsx, pages/_error.tsx: Void's docs,
// guide/pages-routing/errors.md), in the page's language. They take no head(), so React's own
// <title> sets the tab's title (React 19). Their strings are fbtee's like any other: prepare and
// translate them with the app's.
const NOT_FOUND = `// Not found, in the page's language: an address with nothing at it, or a loader that answers 404
// (Void's pages/_not-found, guide/pages-routing/errors.md). Void keeps the 404 status. Written by
// void-fbtee init: change it as you like, with its text in <fbt> so it's translated.
import { fbs, fbt } from "fbtee";
import type { ErrorPageProps } from "@void/react";
import { Link } from "void-fbtee/react";
import { routeUrl } from "void-fbtee/routes";

export default function NotFound({ error }: ErrorPageProps) {
  return (
    <section>
      {/* No head() here: React's own <title> sets the tab's title. */}
      <title>{String(fbs("There's nothing here", "Heading of the page shown for an address with nothing at it"))}</title>
      <p dir="ltr">{error.status}</p>
      <h1>
        <fbt desc="Heading of the page shown for an address with nothing at it">There's nothing here</fbt>
      </h1>
      <Link href={routeUrl("/[lang]")}>
        <fbt desc="Navigation: the home page">Home</fbt>
      </Link>
    </section>
  );
}
`;

const ERROR = `// Something broke while making a page, in the page's language (Void's pages/_error,
// guide/pages-routing/errors.md). Void keeps the status, and hides server details in production.
// "Try again" reruns the page's loader. Written by void-fbtee init: change it as you like, with its
// text in <fbt> so it's translated.
import { fbs, fbt } from "fbtee";
import { useRouter, type ErrorPageProps } from "@void/react";
import { Link } from "void-fbtee/react";
import { routeUrl } from "void-fbtee/routes";

export default function ErrorPage({ error }: ErrorPageProps) {
  const router = useRouter();
  return (
    <section>
      {/* No head() here: React's own <title> sets the tab's title. */}
      <title>{String(fbs("Something went wrong", "Heading of the page shown when the site failed to make a page"))}</title>
      <p dir="ltr">{error.status}</p>
      <h1>
        <fbt desc="Heading of the page shown when the site failed to make a page">Something went wrong</fbt>
      </h1>
      <p>
        <fbt desc="Under the error heading: what to do">
          This page couldn't be made just now. Try again, or start from the home page.
        </fbt>
      </p>
      <button type="button" onClick={() => router.refresh()}>
        <fbt desc="Button: load the page again after an error">Try again</fbt>
      </button>
      <Link href={routeUrl("/[lang]")}>
        <fbt desc="Navigation: the home page">Home</fbt>
      </Link>
    </section>
  );
}
`;

/** Coding agents and their skills folders, as Void's own skill linking detects them. */
const AGENTS = [
  { name: "Claude Code", detect: [".claude", "CLAUDE.md"], skillsDir: ".claude/skills" },
  {
    name: "agents that read .agents/ (Codex and others)",
    detect: [".agents"],
    skillsDir: ".agents/skills",
  },
];

const LINT_RULES: Record<string, unknown> = {
  // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
  "no-unused-vars": ["warn", { varsIgnorePattern: "^(fbt|fbs)$" }],
  "@nkzw/fbtee/no-empty-strings": "error",
  "@nkzw/fbtee/no-unhelpful-desc": "error",
  "void-fbtee/no-show-count-no": "error",
};

/** Versions void-fbtee itself is built and tested with, for the app's package.json. */
function testedVersions(): Record<string, string> {
  const own = createRequire(import.meta.url)("../package.json") as {
    devDependencies: Record<string, string>;
  };
  return own.devDependencies;
}

/** magicast's writeFile leaves no final newline; formatters (vp fmt) tidy the rest. */
const writeModule = (mod: ProxifiedModule, file: string) =>
  writeFileSync(file, generateCode(mod).code.trimEnd() + "\n");

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

/**
 * The workspace the app is part of, if it isn't its own root (then lint settings belong in the
 * workspace's root config). An app with its own pnpm-workspace.yaml, as `void init` makes on
 * Vite+, is its own root.
 */
function workspaceRoot(root: string): string | undefined {
  for (let d = root; d !== dirname(d); d = dirname(d))
    if (existsSync(join(d, "pnpm-workspace.yaml"))) return d === root ? undefined : d;
}

export async function init(o: InitOptions): Promise<InitResult> {
  if (o.site !== undefined) checkSite(o.site);
  // The files init writes, to format with the app's own formatter at the end (Vite+ apps).
  const written = new Set<string>();
  const done: string[] = [];
  const todo: string[] = [];
  const at = (f: string) => join(o.root, f);
  if (!existsSync(at("package.json")))
    throw new Error(
      `no package.json in ${o.root}: run void-fbtee init in the app's folder (or pass --root)`,
    );
  const pkg = readJson(at("package.json"));
  const vitePlus = !!(pkg.devDependencies?.["vite-plus"] ?? pkg.dependencies?.["vite-plus"]);
  const versions = testedVersions();
  // In a workspace, Vite+ runs lint from the root, so fbtee's lint plugin and its rules live there.
  const wsRoot = workspaceRoot(o.root);

  // 1. The peers void-fbtee needs in the app, at the versions void-fbtee is tested with.
  //    void-fbtee itself is already a dependency (it's installed to run init), so it's left as is.
  const need: [string, "dependencies" | "devDependencies"][] = [
    ["fbtee", "dependencies"],
    ["temporal-polyfill", "dependencies"],
  ];
  if (vitePlus && !wsRoot) need.push(["@nkzw/eslint-plugin-fbtee", "devDependencies"]);
  const added = need.filter(([name]) => !pkg.dependencies?.[name] && !pkg.devDependencies?.[name]);
  for (const [name, field] of added) (pkg[field] ??= {})[name] = versions[name];
  // In name order, as package managers keep them.
  for (const field of new Set(added.map(([, f]) => f)))
    pkg[field] = Object.fromEntries(
      Object.entries(pkg[field] as Record<string, string>).sort(([a], [b]) => a.localeCompare(b)),
    );

  // 2. Scripts.
  const scripts = {
    "i18n:prepare": "void-fbtee prepare",
    "i18n:check": "void-fbtee check",
    "i18n:translate": "void-fbtee translate",
  };
  const newScripts = Object.entries(scripts).filter(([k]) => !pkg.scripts?.[k]);
  for (const [k, v] of newScripts) (pkg.scripts ??= {})[k] = v;
  if (added.length || newScripts.length) {
    writeJson(at("package.json"), pkg);
    written.add("package.json");
    if (added.length) done.push(`package.json: added ${added.map(([n]) => n).join(", ")}`);
    if (newScripts.length)
      done.push(`package.json: added scripts ${newScripts.map(([k]) => k).join(", ")}`);
  }

  // 3. Middleware.
  const mwDir = at("middleware");
  const hasMw =
    existsSync(mwDir) &&
    readdirSync(mwDir).some((f) =>
      readFileSync(join(mwDir, f), "utf8").includes("void-fbtee/middleware"),
    );
  if (!hasMw) {
    mkdirSync(mwDir, { recursive: true });
    writeFileSync(join(mwDir, "99.i18n.ts"), MIDDLEWARE);
    written.add("middleware/99.i18n.ts");
    done.push("middleware/99.i18n.ts: created");
  }

  // 4. Root layout.
  const layout = ["pages/layout.tsx", "pages/layout.jsx"].find((f) => existsSync(at(f)));
  if (!layout) {
    mkdirSync(at("pages"), { recursive: true });
    writeFileSync(at("pages/layout.tsx"), LAYOUT);
    written.add("pages/layout.tsx");
    done.push("pages/layout.tsx: created, with <I18nProvider>");
  } else if (!readFileSync(at(layout), "utf8").includes("I18nProvider")) {
    todo.push(
      `${layout}: wrap the layout's children in <I18nProvider> (import { I18nProvider } from "void-fbtee/react"): return <I18nProvider>{children}</I18nProvider>`,
    );
  }

  // 4b. Void's not-found and error pages in the page's language, where the app has none. Only with
  // a home page under pages/[lang]/, which their link home goes to (and the type check needs).
  const PAGE_FILE = /\.(tsx|jsx|ts|js|md|mdx)$/;
  const has = (dir: string, name: string) =>
    existsSync(at(dir)) &&
    readdirSync(at(dir)).some((f) => f.replace(PAGE_FILE, "") === name && PAGE_FILE.test(f));
  const errorPages = [
    { name: "_not-found", code: NOT_FOUND, what: "not-found page" },
    { name: "_error", code: ERROR, what: "error page" },
  ].filter((p) => !has("pages", p.name));
  if (errorPages.length && !has("pages/[lang]", "index"))
    todo.push(
      `pages/_not-found.tsx and pages/_error.tsx: init writes them, in the page's language, once the app has a home page under pages/[lang]/ (their link home goes there); run init again then`,
    );
  else
    for (const p of errorPages) {
      writeFileSync(at(`pages/${p.name}.tsx`), p.code);
      written.add(`pages/${p.name}.tsx`);
      done.push(`pages/${p.name}.tsx: created, Void's ${p.what} in the page's language`);
    }

  // 5. vite.config.ts: the plugin first, with the languages from src/locales.ts (made here if
  // there's none); on Vite+ the lint plugins (in the workspace's root config).
  const viteConfig = ["vite.config.ts", "vite.config.mts", "vite.config.js"].find((f) =>
    existsSync(at(f)),
  );
  if (!viteConfig) {
    todo.push(
      `no vite.config.ts found: add voidFbtee() from "void-fbtee/plugin" first in its plugins`,
    );
  } else {
    const mod = await loadFile(at(viteConfig));
    const code = generateCode(mod).code;
    let changed = false;
    const ownLocales =
      existsSync(at("src/locales.ts")) &&
      !readFileSync(at("src/locales.ts"), "utf8").includes("VoidFbteeRegister");
    if (ownLocales && !code.includes("void-fbtee/plugin"))
      todo.push(
        `src/locales.ts is the app's own: add voidFbtee({ sourceLocale, locales }) from "void-fbtee/plugin" first in ${viteConfig}'s plugins, with the languages declared once and registered as in void-fbtee's SKILL.md`,
      );
    else if (!code.includes("void-fbtee/plugin")) {
      if (!existsSync(at("src/locales.ts"))) {
        mkdirSync(at("src"), { recursive: true });
        writeFileSync(at("src/locales.ts"), localesFile(o.sourceLocale, o.locales));
        written.add("src/locales.ts");
        done.push(
          `src/locales.ts: created, with the languages (${o.locales.join(", ")}) and their type`,
        );
      }
      mod.imports.$append({ from: "./src/locales.ts", imported: "locales" });
      mod.imports.$append({ from: "./src/locales.ts", imported: "sourceLocale" });
      addVitePlugin(mod, {
        from: "void-fbtee/plugin",
        imported: "voidFbtee",
        constructor: "voidFbtee",
        options: builders.raw(
          o.site
            ? `{ sourceLocale, locales, site: ${JSON.stringify(o.site)} }`
            : "{ sourceLocale, locales }",
        ),
        index: 0,
      });
      changed = true;
      done.push(
        `${viteConfig}: added voidFbtee({ sourceLocale, locales${o.site ? ", site" : ""} }) first in plugins, from src/locales.ts`,
      );
    }
    // The site's own address, for each page's canonical, hreflang and og:url (else each request's).
    if (!o.site && !/\bsite\s*:/.test(generateCode(mod).code))
      todo.push(
        `${viteConfig}: add the site's address to voidFbtee(), e.g. voidFbtee({ sourceLocale, locales, site: "https://example.com" }), so every copy of the site names it in canonical, hreflang and og:url (or run init with --site)`,
      );
    if (vitePlus && wsRoot) {
      const rootConfig = join(wsRoot, "vite.config.ts");
      const rootPkg = readJson(join(wsRoot, "package.json"));
      if (!(existsSync(rootConfig) && readFileSync(rootConfig, "utf8").includes("void-fbtee/lint")))
        todo.push(
          `${rootConfig}: Vite+ only reads lint settings from the workspace's root config. Add lint: { jsPlugins: ["@nkzw/eslint-plugin-fbtee", "void-fbtee/lint"], rules: ${JSON.stringify(LINT_RULES)} }`,
        );
      if (!rootPkg.devDependencies?.["@nkzw/eslint-plugin-fbtee"])
        todo.push(
          `${join(wsRoot, "package.json")}: add "@nkzw/eslint-plugin-fbtee": "${versions["@nkzw/eslint-plugin-fbtee"]}" to devDependencies (lint runs from the workspace root)`,
        );
    } else if (vitePlus && !code.includes("void-fbtee/lint")) {
      // Only Vite+'s defineConfig knows `lint`, so the import moves to vite-plus (as `vp migrate`
      // does to config files). Plain-Vite apps get the same checks from `void-fbtee check`.
      for (const imp of mod.imports.$items)
        if (imp.from === "vite" && imp.imported === "defineConfig") imp.from = "vite-plus";
      const options = getDefaultExportOptions(mod);
      options.lint ??= {};
      options.lint.jsPlugins ??= [];
      for (const p of ["@nkzw/eslint-plugin-fbtee", "void-fbtee/lint"])
        if (!options.lint.jsPlugins.includes(p)) options.lint.jsPlugins.push(p);
      options.lint.rules ??= {};
      for (const [rule, level] of Object.entries(LINT_RULES)) options.lint.rules[rule] ??= level;
      changed = true;
      done.push(`${viteConfig}: added fbtee's and void-fbtee's lint rules (Vite+ lint.jsPlugins)`);
    }
    if (changed) writeModule(mod, at(viteConfig));
    if (changed) written.add(viteConfig);
  }

  // 6. void.config.ts: Cloudflare's temporal flag (native Temporal in the worker), and "/" sent to
  // the source language by Void's own redirects (before any app code runs).
  const voidConfig = ["void.config.ts", "void.config.mts", "void.config.js"].find((f) =>
    existsSync(at(f)),
  );
  if (!voidConfig) {
    todo.push(
      `no void.config.ts found: add worker: { compatibility_flags: ["temporal"] } and routing: { redirects: { "/": { to: "/${o.sourceLocale}", status: 301 } } }`,
    );
  } else {
    const mod = await loadFile(at(voidConfig));
    const options = getDefaultExportOptions(mod);
    options.worker ??= {};
    options.worker.compatibility_flags ??= [];
    let changed = false;
    if (!options.worker.compatibility_flags.includes("temporal")) {
      options.worker.compatibility_flags.push("temporal");
      changed = true;
      done.push(`${voidConfig}: added Cloudflare's "temporal" compatibility flag`);
    }
    options.routing ??= {};
    options.routing.redirects ??= {};
    if (options.routing.redirects["/"] === undefined) {
      options.routing.redirects["/"] = { to: `/${o.sourceLocale}`, status: 301 };
      changed = true;
      done.push(`${voidConfig}: added the redirect from "/" to /${o.sourceLocale} (301)`);
    }
    if (changed) writeModule(mod, at(voidConfig));
    if (changed) written.add(voidConfig);
  }

  // 7. tsconfig.json: fbtee's JSX types, ES2025 (Temporal, Intl.DurationFormat) and the DOM.
  if (existsSync(at("tsconfig.json"))) {
    let ts: { compilerOptions?: { types?: string[]; lib?: string[] } };
    try {
      ts = readJson(at("tsconfig.json"));
    } catch {
      ts = {};
      todo.push(
        `tsconfig.json: add "fbtee/ReactTypes" to compilerOptions.types and "lib": ["ES2025", "DOM", "DOM.Iterable"]`,
      );
    }
    if (ts.compilerOptions) {
      const c = ts.compilerOptions;
      let changed = false;
      if (!c.types?.includes("fbtee/ReactTypes")) {
        c.types = [...(c.types ?? []), "fbtee/ReactTypes"];
        changed = true;
      }
      for (const lib of ["ES2025", "DOM", "DOM.Iterable"])
        if (!c.lib?.includes(lib)) {
          c.lib = [...(c.lib ?? []), lib];
          changed = true;
        }
      if (changed) {
        writeJson(at("tsconfig.json"), ts);
        written.add("tsconfig.json");
        done.push(`tsconfig.json: added fbtee's JSX types and ES2025 + DOM libraries`);
      }
    }
  }

  // 8. The catalogs folder.
  if (!existsSync(at(DEFAULT_TRANSLATIONS))) {
    mkdirSync(at(DEFAULT_TRANSLATIONS), { recursive: true });
    done.push(`${DEFAULT_TRANSLATIONS}/: created (void-fbtee prepare fills it)`);
  }

  // 9. AGENTS.md: point coding agents at void-fbtee's skill, like Void's own block.
  const agents = at("AGENTS.md");
  const current = existsSync(agents) ? readFileSync(agents, "utf8") : "";
  if (!current.includes(AGENTS_START)) {
    writeFileSync(agents, (current ? current.trimEnd() + "\n\n" : "") + AGENTS_BLOCK + "\n");
    written.add("AGENTS.md");
    done.push("AGENTS.md: added void-fbtee's section for coding agents");
  }

  // 10. Link the skill into each coding agent's skills folder, as `void init` does with Void's:
  //     a relative link, for the agents whose folder the app already has.
  const target = join(o.root, "node_modules/void-fbtee/skills/void-fbtee");
  for (const agent of AGENTS) {
    if (!agent.detect.some((f) => existsSync(at(f)))) continue;
    const link = at(join(agent.skillsDir, "void-fbtee"));
    const want = relative(dirname(link), target);
    let current: string | undefined;
    try {
      current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : "(not a link)";
    } catch {}
    if (current === want) continue;
    if (current) {
      todo.push(`${agent.skillsDir}/void-fbtee exists but isn't the link to ${want}; left alone`);
      continue;
    }
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(want, link, process.platform === "win32" ? "junction" : "dir");
    done.push(`${agent.skillsDir}/void-fbtee: linked void-fbtee's skill for ${agent.name}`);
  }

  // Vite+ apps check formatting (`vp check`), so what init wrote is formatted by the app's own
  // formatter and settings, `vp fmt`, rather than left as JSON.stringify and magicast print it.
  const toFormat = [...written].filter((f) => existsSync(at(f)));
  if (vitePlus && toFormat.length) {
    try {
      execFileSync("vp", ["fmt", ...toFormat], { cwd: o.root, stdio: "ignore" });
    } catch {
      todo.push(`vp fmt ${toFormat.join(" ")} (init couldn't run it)`);
    }
  }

  // Vite+ apps run everything through vp (it picks the package manager itself).
  const pm = vitePlus ? "vp" : packageManager(o.root);
  if (added.length) todo.unshift(`${pm} install (for the added dependencies)`);
  todo.push(`${pm} run i18n:prepare (makes each locale's catalog), then ${pm} run i18n:translate`);
  return { done, todo };
}
