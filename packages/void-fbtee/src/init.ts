// `void-fbtee init`: wires void-fbtee into a `void init` app. Each step only
// adds what's missing, so running it twice changes nothing. Where it can't edit a file safely it
// prints the exact lines to add instead of guessing. Config files are edited with magicast.
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
import { packageManager } from "./translate";

export interface InitOptions {
  root: string;
  sourceLocale: string;
  locales: string[];
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

declare module "void-fbtee/locales" {
  interface Register {
    locales: typeof locales;
  }
}
`;

const MIDDLEWARE = `// Locale from the URL, fbtee's per-request state, <html lang dir>. 99 so Void runs it after the
// app's own middleware (01.auth.ts and the like): it adds to the shared and head data they set.
export { default } from "void-fbtee/middleware";
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
    done.push("middleware/99.i18n.ts: created");
  }

  // 4. Root layout.
  const layout = ["pages/layout.tsx", "pages/layout.jsx"].find((f) => existsSync(at(f)));
  if (!layout) {
    mkdirSync(at("pages"), { recursive: true });
    writeFileSync(at("pages/layout.tsx"), LAYOUT);
    done.push("pages/layout.tsx: created, with <I18nProvider>");
  } else if (!readFileSync(at(layout), "utf8").includes("I18nProvider")) {
    todo.push(
      `${layout}: wrap the layout's children in <I18nProvider> (import { I18nProvider } from "void-fbtee/react"): return <I18nProvider>{children}</I18nProvider>`,
    );
  }

  // 5. vite.config.ts: the plugin first, with the languages from src/locales.ts (made here if
  // there's none); on Vite+ the lint plugins (in the workspace's root config).
  const viteConfig = ["vite.config.ts", "vite.config.mts", "vite.config.js"].find((f) =>
    existsSync(at(f)),
  );
  if (!viteConfig) {
    todo.push(
      `no vite.config.ts found: add voidFbtee() from "void-fbtee/vite" first in its plugins`,
    );
  } else {
    const mod = await loadFile(at(viteConfig));
    const code = generateCode(mod).code;
    let changed = false;
    const ownLocales =
      existsSync(at("src/locales.ts")) &&
      !readFileSync(at("src/locales.ts"), "utf8").includes("void-fbtee/locales");
    if (ownLocales && !code.includes("void-fbtee/vite"))
      todo.push(
        `src/locales.ts is the app's own: add voidFbtee({ sourceLocale, locales }) from "void-fbtee/vite" first in ${viteConfig}'s plugins, with the languages declared once and registered as in void-fbtee's SKILL.md`,
      );
    else if (!code.includes("void-fbtee/vite")) {
      if (!existsSync(at("src/locales.ts"))) {
        mkdirSync(at("src"), { recursive: true });
        writeFileSync(at("src/locales.ts"), localesFile(o.sourceLocale, o.locales));
        done.push(
          `src/locales.ts: created, with the languages (${o.locales.join(", ")}) and their type`,
        );
      }
      mod.imports.$append({ from: "./src/locales", imported: "locales" });
      mod.imports.$append({ from: "./src/locales", imported: "sourceLocale" });
      addVitePlugin(mod, {
        from: "void-fbtee/vite",
        imported: "default",
        constructor: "voidFbtee",
        options: { sourceLocale: builders.raw("sourceLocale"), locales: builders.raw("locales") },
        index: 0,
      });
      changed = true;
      done.push(
        `${viteConfig}: added voidFbtee({ sourceLocale, locales }) first in plugins, from src/locales.ts`,
      );
    }
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
  }

  // 6. void.config.ts: Cloudflare's temporal flag (native Temporal in the worker).
  const voidConfig = ["void.config.ts", "void.config.mts", "void.config.js"].find((f) =>
    existsSync(at(f)),
  );
  if (!voidConfig) {
    todo.push(`no void.config.ts found: add worker: { compatibility_flags: ["temporal"] }`);
  } else {
    const mod = await loadFile(at(voidConfig));
    const options = getDefaultExportOptions(mod);
    options.worker ??= {};
    options.worker.compatibility_flags ??= [];
    if (!options.worker.compatibility_flags.includes("temporal")) {
      options.worker.compatibility_flags.push("temporal");
      writeModule(mod, at(voidConfig));
      done.push(`${voidConfig}: added Cloudflare's "temporal" compatibility flag`);
    }
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

  // Vite+ apps run everything through vp (it picks the package manager itself).
  const pm = vitePlus ? "vp" : packageManager(o.root);
  if (added.length) todo.unshift(`${pm} install (for the added dependencies)`);
  todo.push(`${pm} run i18n:prepare (makes each locale's catalog), then ${pm} run i18n:translate`);
  return { done, todo };
}
