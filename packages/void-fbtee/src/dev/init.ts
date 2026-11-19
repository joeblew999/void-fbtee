// `void-fbtee init`: wires void-fbtee into a `void init` app. Each step only
// adds what's missing, so running it twice changes nothing. Where it can't edit a file safely it
// prints the exact lines to add instead of guessing. Config files are edited with magicast.
import { execFileSync } from "node:child_process";
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
import { dirname, join, matchesGlob, relative, sep } from "node:path";
import { builders, generateCode, loadFile, type ProxifiedModule } from "magicast";
import { addVitePlugin, getDefaultExportOptions } from "magicast/helpers";
import {
  firstFile,
  hasI18nMiddleware,
  HOME_PAGES,
  LAYOUTS,
  MIDDLEWARE,
  SKILL_DIR,
  VITE_CONFIGS,
  VOID_CONFIGS,
} from "./app-files";
import { DEFAULT_TRANSLATIONS } from "./catalogs";
import { checkSite } from "./site";
import { packageDir, packageManager } from "./translate";
import { field, isRecord, isStringArray, parseJson, textRecord } from "../guards";

export interface InitOptions {
  root: string;
  sourceLocale: string;
  locales: Array<string>;
  /** The site's own address, for voidFbtee({ site }); checked as the plugin checks it. */
  site?: string;
}

export interface InitResult {
  /** What init changed, one line each. */
  done: Array<string>;
  /** What the person must do by hand, one line each (with the exact text to add). */
  todo: Array<string>;
}

const SKILL = `${SKILL_DIR}/SKILL.md`;
const AGENTS_START = "<!--injected-by-void-fbtee-->";
const AGENTS_END = "<!--/injected-by-void-fbtee-->";
const AGENTS_BLOCK = `${AGENTS_START}
## void-fbtee (i18n)

- This app is translated with [void-fbtee](https://github.com/joeblew999/void-fbtee): fbtee strings, Temporal dates, Intl formatting.
- For anything about translations, read \`${SKILL}\` first.
- Translating is part of the dev server: \`vp dev\` prepares each new string, translates what's new as you save, and reports what's left. \`vp build\` fails on anything left. There are no i18n scripts.

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
  locales: Array<string>,
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
      <title>{fbs("There's nothing here", "Heading of the page shown for an address with nothing at it")}</title>
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
      <title>{fbs("Something went wrong", "Heading of the page shown when the site failed to make a page")}</title>
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

const SITEMAP = `// The sitemap, at /sitemap.xml: every page in every language (void-fbtee's sitemap()). Add the app's
// own pages, such as one per event, with sitemap(c, { pages: [...] }). Written by void-fbtee init.
import { defineHandler } from "void";
import { sitemap } from "void-fbtee/server";

export const GET = defineHandler((c) => sitemap(c));
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
  // fbtee's strict set (configs.strict in @nkzw/eslint-plugin-fbtee); init.test.ts checks this list
  // still matches it. Strict also finds text nobody wrapped for translation: a warning, not an
  // error, since every new Void app starts with Void's English starter page, and `vp check` would
  // fail the moment void-fbtee is added. JSX's spacing ({" "}) isn't text; the app adds its own
  // names (its own, products') to ignoredWords.
  "@nkzw/fbtee/no-empty-strings": "error",
  "@nkzw/fbtee/no-unhelpful-desc": "error",
  "@nkzw/fbtee/no-untranslated-strings": ["warn", { ignoredWords: [" "] }],
  "@nkzw/fbtee/prefer-fbs": "error",
};
// What init added before fbtee 6 fixed hidden plural counts (fbtee#83); taken out again.
const OLD_PLUGIN = "void-fbtee/lint";
const OLD_RULE = "void-fbtee/no-show-count-no";

/** Versions void-fbtee itself is built and tested with, for the app's package.json. */
function testedVersions(): Record<string, string> {
  return readJson(join(packageDir(), "package.json")).devDependencies ?? {};
}

/** magicast's writeFile leaves no final newline; formatters (vp fmt) tidy the rest. */
const writeModule = (mod: ProxifiedModule, file: string) =>
  writeFileSync(file, generateCode(mod).code.trimEnd() + "\n");

/** A package.json, its dependency lists and scripts checked (each a list of text); the rest kept
 * as it is, in its order, for writing back. */
interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}
const readJson = (file: string): PackageJson => {
  const value = parseJson(readFileSync(file, "utf8"));
  if (!isRecord(value)) {
    throw new Error(`void-fbtee: ${file} isn't a package.json`);
  }
  const list = (key: string) => (value[key] === undefined ? undefined : textRecord(value[key]));
  return {
    ...value,
    dependencies: list("dependencies"),
    devDependencies: list("devDependencies"),
    scripts: list("scripts"),
  };
};
/**
 * A config file's default export's options object, as magicast gives it (a proxy that edits the
 * file), checked to be an object. magicast types it `any`; it's an object, or there's nothing to
 * edit.
 */
function configObject(mod: ProxifiedModule, file: string): Record<string, unknown> {
  const options: unknown = getDefaultExportOptions(mod);
  if (!isRecord(options)) {
    throw new Error(`void-fbtee: ${file} doesn't export a config object`);
  }
  return options;
}

/**
 * A list from a config file as plain values, or none. magicast's lists are proxies whose callbacks
 * (`.some`, `.every`) don't get the plain values; spreading one does (checked 2026-11-19).
 */
function plainList(value: unknown): Array<unknown> {
  const list: Array<unknown> = Array.isArray(value) ? value : [];
  return [...list];
}

/** An object's object field, made when it isn't one (magicast writes it into the file). */
function child(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  if (!isRecord(parent[key])) {
    parent[key] = {};
  }
  const value = parent[key];
  if (!isRecord(value)) {
    throw new Error(`void-fbtee: couldn't add "${key}"`);
  }
  return value;
}

/** Code written as it is into a config (magicast's builders.raw), checked: magicast types it
 * `any`; it's an object, a proxy for that code. */
function rawCode(source: string): Record<string, unknown> {
  const node: unknown = builders.raw(source);
  if (!isRecord(node)) {
    throw new Error(`void-fbtee: couldn't write ${source}`);
  }
  return node;
}

/** A tsconfig.json, its compilerOptions' `types` and `lib` checked; the rest kept as it is. */
interface TsConfig {
  compilerOptions?: { types?: Array<string>; lib?: Array<string>; [key: string]: unknown };
  [key: string]: unknown;
}
const readTsconfig = (file: string): TsConfig => {
  const value = parseJson(readFileSync(file, "utf8"));
  if (!isRecord(value)) {
    throw new Error(`void-fbtee: ${file} isn't a tsconfig.json`);
  }
  const options = value.compilerOptions;
  if (options === undefined) {
    return value;
  }
  if (!isRecord(options)) {
    throw new Error(`void-fbtee: ${file}'s compilerOptions isn't an object`);
  }
  const { types, lib } = options;
  if (
    (types !== undefined && !isStringArray(types)) ||
    (lib !== undefined && !isStringArray(lib))
  ) {
    throw new Error(`void-fbtee: ${file}'s compilerOptions.types and lib must be lists of text`);
  }
  return { ...value, compilerOptions: { ...options, types, lib } };
};
const writeJson = (file: string, value: unknown) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

/**
 * The workspace the app is part of, if it isn't its own root (then lint settings belong in the
 * workspace's root config). An app with its own pnpm-workspace.yaml, as `void init` makes on
 * Vite+, is its own root. As pnpm decides it: the nearest pnpm-workspace.yaml above the app, and
 * the app only if its `packages` list takes it in (an app that merely sits in another repo's
 * folder isn't part of that repo's workspace).
 */
function workspaceRoot(root: string): string | undefined {
  for (let d = root; d !== dirname(d); d = dirname(d)) {
    const file = join(d, "pnpm-workspace.yaml");
    if (!existsSync(file)) {
      continue;
    }
    if (d === root) {
      return undefined;
    }
    const globs = workspacePackages(readFileSync(file, "utf8"));
    const at = relative(d, root).split(sep).join("/");
    const listed = globs.filter((g) => !g.startsWith("!")).some((g) => matchesGlob(at, g));
    const left = globs.filter((g) => g.startsWith("!")).some((g) => matchesGlob(at, g.slice(1)));
    return listed && !left ? d : undefined;
  }
}

/** pnpm-workspace.yaml's `packages` list: its `- glob` lines, quotes taken off. */
function workspacePackages(yaml: string): Array<string> {
  const out: Array<string> = [];
  let inList = false;
  for (const line of yaml.split("\n")) {
    if (/^packages:\s*$/.test(line)) {
      inList = true;
    } else if (inList && /^\s+-\s+/.test(line)) {
      out.push(
        line
          .replace(/^\s+-\s+/, "")
          .replace(/\s+#.*$/, "")
          .replace(/^["']|["']$/g, ""),
      );
    } else if (inList && /^\S/.test(line)) {
      inList = false;
    }
  }
  return out;
}

export async function init(o: InitOptions): Promise<InitResult> {
  if (o.site !== undefined) {
    checkSite(o.site);
  }
  // The files init writes, to format with the app's own formatter at the end (Vite+ apps).
  const written = new Set<string>();
  const done: Array<string> = [];
  const todo: Array<string> = [];
  const at = (f: string) => join(o.root, f);
  if (!existsSync(at("package.json"))) {
    throw new Error(
      `no package.json in ${o.root}: run void-fbtee init in the app's folder (or pass --root)`,
    );
  }
  const pkg = readJson(at("package.json"));
  const vitePlus = !!(pkg.devDependencies?.["vite-plus"] ?? pkg.dependencies?.["vite-plus"]);
  const versions = testedVersions();
  // In a workspace, Vite+ runs lint from the root, so fbtee's lint plugin and its rules live there.
  const wsRoot = workspaceRoot(o.root);

  // 1. The peers void-fbtee needs in the app, at the versions void-fbtee is tested with.
  //    void-fbtee itself is already a dependency (it's installed to run init), so it's left as is.
  const need: Array<[string, "dependencies" | "devDependencies"]> = [
    ["fbtee", "dependencies"],
    ["temporal-polyfill", "dependencies"],
  ];
  if (vitePlus && !wsRoot) {
    need.push(["@nkzw/eslint-plugin-fbtee", "devDependencies"]);
  }
  const added = need.filter(([name]) => !pkg.dependencies?.[name] && !pkg.devDependencies?.[name]);
  for (const [name, field] of added) {
    const version = versions[name];
    if (version === undefined) {
      throw new Error(`void-fbtee: no tested version of ${name} in void-fbtee's own package.json`);
    }
    (pkg[field] ??= {})[name] = version;
  }
  // In name order, as package managers keep them.
  for (const field of new Set(added.map(([, f]) => f))) {
    pkg[field] = Object.fromEntries(
      Object.entries(pkg[field] ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  // 2. Scripts: none. vp dev and vp build do the work, so the i18n:* scripts an earlier init
  // added (their void-fbtee commands are gone) are taken out.
  const oldScripts = Object.entries(pkg.scripts ?? {})
    .filter(
      ([k, v]) =>
        k.startsWith("i18n:") && /^void-fbtee (prepare|check|translate|stamp)\b/.test(String(v)),
    )
    .map(([k]) => k);
  for (const k of oldScripts) {
    delete pkg.scripts?.[k];
  }
  if (added.length || oldScripts.length) {
    writeJson(at("package.json"), pkg);
    written.add("package.json");
    if (added.length) {
      done.push(`package.json: added ${added.map(([n]) => n).join(", ")}`);
    }
    if (oldScripts.length) {
      done.push(
        `package.json: removed scripts ${oldScripts.join(", ")} (vp dev and vp build do it)`,
      );
    }
  }

  // 3. Middleware.
  const mwDir = at("middleware");
  if (!hasI18nMiddleware(o.root)) {
    mkdirSync(mwDir, { recursive: true });
    writeFileSync(join(mwDir, "99.i18n.ts"), MIDDLEWARE);
    written.add("middleware/99.i18n.ts");
    done.push("middleware/99.i18n.ts: created");
  }

  // 4. Root layout.
  const layout = firstFile(o.root, LAYOUTS);
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
  if (errorPages.length && !has("pages/[lang]", "index")) {
    todo.push(
      `pages/_not-found.tsx and pages/_error.tsx: init writes them, in the page's language, once the app has a home page under pages/[lang]/ (their link home goes there); run init again then`,
    );
  } else {
    for (const p of errorPages) {
      writeFileSync(at(`pages/${p.name}.tsx`), p.code);
      written.add(`pages/${p.name}.tsx`);
      done.push(`pages/${p.name}.tsx: created, Void's ${p.what} in the page's language`);
    }
  }
  // Their text is in English, init's own language. In an app written in another language the code's
  // text is that language's (the source), so the developer rewrites it; prepare then translates it.
  const englishPages = errorPages.filter((p) => written.has(`pages/${p.name}.tsx`));
  if (englishPages.length && new Intl.Locale(o.sourceLocale).language !== "en") {
    todo.push(
      `${englishPages.map((p) => `pages/${p.name}.tsx`).join(" and ")}: their text is in English; write it in ${o.sourceLocale}, the code's language; the dev server then translates it`,
    );
  }

  // 4c. The sitemap, where the app has none.
  if (!has("routes", "sitemap.xml")) {
    mkdirSync(at("routes"), { recursive: true });
    writeFileSync(at("routes/sitemap.xml.ts"), SITEMAP);
    written.add("routes/sitemap.xml.ts");
    done.push("routes/sitemap.xml.ts: created, every page in every language");
  }

  // 5. vite.config.ts: the plugin first, with the languages from src/locales.ts (made here if
  // there's none); on Vite+ the lint plugins (in the workspace's root config).
  const viteConfig = firstFile(o.root, VITE_CONFIGS);
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
    if (ownLocales && !code.includes("void-fbtee/plugin")) {
      todo.push(
        `src/locales.ts is the app's own: add voidFbtee({ sourceLocale, locales }) from "void-fbtee/plugin" first in ${viteConfig}'s plugins, with the languages declared once and registered as in void-fbtee's SKILL.md`,
      );
    } else if (!code.includes("void-fbtee/plugin")) {
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
        options: rawCode(
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
    if (!o.site && !/\bsite\s*:/.test(generateCode(mod).code)) {
      todo.push(
        `${viteConfig}: add the site's address to voidFbtee(), e.g. voidFbtee({ sourceLocale, locales, site: "https://example.com" }), so every copy of the site names it in canonical, hreflang and og:url (or run init with --site)`,
      );
    }
    if (vitePlus && wsRoot) {
      const rootConfig = join(wsRoot, "vite.config.ts");
      const rootPkg = readJson(join(wsRoot, "package.json"));
      const rootText = existsSync(rootConfig) ? readFileSync(rootConfig, "utf8") : "";
      if (!rootText.includes("@nkzw/eslint-plugin-fbtee")) {
        todo.push(
          `${rootConfig}: Vite+ only reads lint settings from the workspace's root config. Add lint: { jsPlugins: ["@nkzw/eslint-plugin-fbtee"], rules: ${JSON.stringify(LINT_RULES)} }`,
        );
      }
      if (rootText.includes(OLD_PLUGIN)) {
        todo.push(
          `${rootConfig}: remove "${OLD_PLUGIN}" from lint.jsPlugins and "${OLD_RULE}" from lint.rules (void-fbtee no longer has them: fbtee 6 fixed what they caught)`,
        );
      }
      if (!rootPkg.devDependencies?.["@nkzw/eslint-plugin-fbtee"]) {
        todo.push(
          `${join(wsRoot, "package.json")}: add "@nkzw/eslint-plugin-fbtee": "${versions["@nkzw/eslint-plugin-fbtee"]}" to devDependencies (lint runs from the workspace root)`,
        );
      }
    } else if (vitePlus) {
      // fbtee's lint plugin and rules, and none of what init added before fbtee 6. Only Vite+'s
      // defineConfig knows `lint`, so the import moves to vite-plus (as `vp migrate` does).
      const options = configObject(mod, viteConfig);
      const given = field(options, "lint");
      const givenPlugins = plainList(field(given, "jsPlugins"));
      const plugins: Array<string> = isStringArray(givenPlugins) ? givenPlugins : [];
      const givenRules = field(given, "rules");
      const rules: Record<string, unknown> = isRecord(givenRules) ? { ...givenRules } : {};
      const wanted = plugins.filter((p) => p !== OLD_PLUGIN);
      if (!wanted.includes("@nkzw/eslint-plugin-fbtee")) {
        wanted.push("@nkzw/eslint-plugin-fbtee");
      }
      const missingRules = Object.keys(LINT_RULES).filter((r) => !(r in rules));
      if (
        JSON.stringify(wanted) !== JSON.stringify(plugins) ||
        missingRules.length ||
        OLD_RULE in rules
      ) {
        for (const imp of mod.imports.$items) {
          if (imp.from === "vite" && imp.imported === "defineConfig") {
            imp.from = "vite-plus";
          }
        }
        const lint = child(options, "lint");
        lint.jsPlugins = wanted;
        const lintRules = child(lint, "rules");
        for (const r of missingRules) {
          lintRules[r] = LINT_RULES[r];
        }
        delete lintRules[OLD_RULE];
        changed = true;
        done.push(`${viteConfig}: fbtee's lint rules (Vite+ lint.jsPlugins)`);
      }
    }
    if (changed) {
      writeModule(mod, at(viteConfig));
    }
    if (changed) {
      written.add(viteConfig);
    }
  }

  // 6. void.config.ts: Cloudflare's temporal flag (native Temporal in the worker). "/" is
  // void-fbtee's middleware's (each visitor to their own language), so the fixed redirect init
  // once wrote goes, and only that one: any other "/" redirect is the app's own.
  const voidConfig = firstFile(o.root, VOID_CONFIGS);
  if (!voidConfig) {
    todo.push(`no void.config.ts found: add worker: { compatibility_flags: ["temporal"] }`);
  } else {
    const mod = await loadFile(at(voidConfig));
    const options = configObject(mod, voidConfig);
    const worker = child(options, "worker");
    if (!Array.isArray(worker.compatibility_flags)) {
      worker.compatibility_flags = [];
    }
    const flags: unknown = worker.compatibility_flags;
    let changed = false;
    if (Array.isArray(flags) && !plainList(flags).includes("temporal")) {
      flags.push("temporal");
      changed = true;
      done.push(`${voidConfig}: added Cloudflare's "temporal" compatibility flag`);
    }
    const redirects = field(field(options, "routing"), "redirects");
    const old = field(redirects, "/");
    if (
      isRecord(redirects) &&
      field(old, "to") === `/${o.sourceLocale}` &&
      field(old, "status") === 301
    ) {
      delete redirects["/"];
      changed = true;
      done.push(
        `${voidConfig}: removed the fixed redirect from "/" to /${o.sourceLocale}: "/" now sends each visitor to their own language`,
      );
    }
    if (changed) {
      writeModule(mod, at(voidConfig));
    }
    if (changed) {
      written.add(voidConfig);
    }
  }

  // An own "/" page (a new Void app's starter, pages/index.tsx) is hidden: "/" goes to each
  // visitor's language. The developer decides: move it under pages/[lang]/, or keep it.
  const ownHome = HOME_PAGES.find((f) => existsSync(at(f)));
  if (ownHome) {
    todo.push(
      `${ownHome}: hidden, since "/" sends each visitor to their own language; put the home page in pages/[lang]/index.tsx and delete ${ownHome}, or keep it with voidFbtee({ redirectHome: false })`,
    );
  }

  // 7. tsconfig.json: fbtee's JSX types, ES2025 (Temporal, Intl.DurationFormat) and the DOM.
  if (existsSync(at("tsconfig.json"))) {
    let ts: TsConfig;
    try {
      ts = readTsconfig(at("tsconfig.json"));
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
      for (const lib of ["ES2025", "DOM", "DOM.Iterable"]) {
        if (!c.lib?.includes(lib)) {
          c.lib = [...(c.lib ?? []), lib];
          changed = true;
        }
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
    done.push(`${DEFAULT_TRANSLATIONS}/: created (the dev server fills it)`);
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
  const target = join(o.root, SKILL_DIR);
  for (const agent of AGENTS) {
    if (!agent.detect.some((f) => existsSync(at(f)))) {
      continue;
    }
    const link = at(join(agent.skillsDir, "void-fbtee"));
    const want = relative(dirname(link), target);
    let current: string | undefined;
    try {
      current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : "(not a link)";
    } catch {
      // Nothing there yet: it's linked below.
    }
    if (current === want) {
      continue;
    }
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
  if (added.length) {
    todo.unshift(`${pm} install (for the added dependencies)`);
  }
  todo.push(
    `${vitePlus ? "vp dev" : `${pm} run dev`}: makes each language's catalog and translates what's new as you work; ${vitePlus ? "vp build" : `${pm} run build`} fails on anything left`,
  );
  return { done, todo };
}
