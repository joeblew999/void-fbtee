// The void-fbtee Vite plugin. Put it first in the app's vite.config.ts plugins.
//
// What it does, and why:
// - Runs fbtee's own Vite plugin, which compiles <fbt> and fbs.
// - Server environments: resolves `fbtee/server` to fbtee's per-request (AsyncLocalStorage) build.
//   fbtee only exports it under the `node` condition, and workerd isn't `node`.
// - Server environments don't pre-bundle fbtee, so `fbtee` and `fbtee/server` share one core.
// - Server environments resolve `temporal-polyfill` to Cloudflare's own Temporal (the `temporal`
//   compatibility flag, which init adds and check requires), so no polyfill code goes in the
//   worker. It once shipped broken (workerd#6907, July 2026, with no flag); the flag's version is
//   documented and its Temporal.Now reads Date.now()'s clock. The browser keeps the polyfill's
//   own "native if present", and so do tests under Vitest, which run in Node.js.
// - Builds each locale's catalog in-process from i18n/translations/<locale>.json and the app's
//   source (plus fbtee's built-in strings), as `virtual:void-fbtee/catalogs`. Nothing generated
//   goes in git. Shared with the void-fbtee command: catalogs.ts.
// - Reports untranslated strings once per run: a warning in dev, a report in a build, and with
//   `failOnMissing` a failed build, so `void deploy` (which runs `vite build`) can't ship gaps.
// - Browser: every app module that uses <fbt> or fbs first imports `void-fbtee/client`, which
//   installs the page's catalog (top-level await). Islands hydrate without the layout's
//   I18nProvider, so this is what gives them their strings.
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import fbteeVite from "@nkzw/vite-plugin-fbtee";
import type { FallbackLocales } from "fbtee";
import { resolveLocales, translatedOf, type LocaleConfig, type LocaleInput } from "./locales";
import {
  DEFAULT_SRC,
  DEFAULT_TRANSLATIONS,
  catalogFile,
  collect,
  formatMissing,
  missing,
  runtimeCatalog,
  runtimeTexts,
  type Project,
} from "./catalogs";
import { checkSite } from "./site";

export interface VoidFbteeOptions {
  /** The language the app's <fbt> strings are written in, e.g. "en-US". */
  sourceLocale: string;
  /** Every locale the app serves, the source locale included. */
  locales: readonly LocaleInput[];
  /** Folder of editable translation files, one <locale>.json each. Default "i18n/translations". */
  translations?: string;
  /** Source files to collect strings from. Default: every folder of code in a Void app (DEFAULT_SRC, catalogs.ts). */
  src?: string[];
  /**
   * Fail `vite build` (and so `void deploy`) when any locale has untranslated strings, fbtee's
   * own built-in strings included. Never fails the dev server. Default false: the build reports.
   */
  failOnMissing?: boolean;
  /**
   * fbtee's own `fallbackLocales` option, passed to fbtee as is: catalogs to try after a
   * locale's natural parents (de-AT -> de) and before the source text. See fbtee's README,
   * "Locale Matching and Fallback".
   */
  fallbackLocales?: FallbackLocales;
  /**
   * The site's own address, e.g. "https://example.com": each page's canonical, hreflang and og:url
   * are built from it, so a copy of the site at another address (the dev server, a Worker
   * Preview) still names the real one. `https://`, host only: no path, no trailing slash. Without
   * it, the address each request came to.
   */
  site?: string;
  /**
   * fbtee's common strings (its `fbtCommon` option): labels used across the app, each with one
   * description, e.g. { Save: "Button label for saving changes" }. Write `<fbt common>Save</fbt>`
   * (or `fbt.c("Save")`) without repeating it. See fbtee's README, "Common Strings".
   */
  common?: Record<string, string>;
}

/** What the plugin exposes on its `api`, for the void-fbtee command (read with resolveConfig). */
export interface VoidFbteeApi {
  options: VoidFbteeOptions;
  project(): Project;
}

const CONFIG_ID = "virtual:void-fbtee/config";
const CATALOGS_ID = "virtual:void-fbtee/catalogs";
const CATALOG_PREFIX = "virtual:void-fbtee/catalog/";
const TEXTS_ID = "virtual:void-fbtee/texts";
/** The app's markdown pages (@void/md's own list), or none when the app doesn't use @void/md. */
const MD_PAGES_ID = "virtual:void-fbtee/md-pages";
/**
 * Zod's own messages in the app's languages, when the app has Zod 4 (Void's validators are often
 * Zod: drizzle-zod's, or Zod by hand, guide/server-routing.md "Manual validators"). The middleware
 * points Zod's `localeError` at the current request's language; an app's own messages still win
 * (Zod ranks `localeError` below a schema's own and `customError`: zod.dev/error-customization).
 * Without Zod 4, it does nothing.
 */
const ZOD_ID = "virtual:void-fbtee/zod";
/**
 * The app's pages in every language: each page under pages/[lang]/ whose only parameter is the
 * language, from Void's own list of the app's pages (PagePathMap in the .void/routes.d.ts Void
 * generates), for the sitemap (sitemap() in server.ts).
 */
const PAGES_ID = "virtual:void-fbtee/pages";
/** What `temporal-polyfill` is on the server: the runtime's own Temporal (Cloudflare's flag). */
const SERVER_TEMPORAL_ID = "\0void-fbtee:server-temporal";
// Hono's route helper, as Void's own copy of Hono: matchedRoutes reads Hono's request internals, so
// it must be the Hono Void runs on. Void resolves "hono/route" from its own files; so does this.
const HONO_ROUTE_ID = "virtual:void-fbtee/hono-route";
// Hook filters (Vite's api-plugin "Hook Filters"): the hooks only run for these ids, not every module.
// Each handler still checks the id itself, as Vite advises for versions without filters.
const RESOLVE_FILTER = /^(?:virtual:void-fbtee\/|fbtee\/server$|temporal-polyfill$)/;
const LOAD_FILTER = /^\0(?:virtual:void-fbtee\/|void-fbtee:)/;

/** The browser's environment, by Vite's own flag (an environment's name can be anything). */
const isClient = (env: { config: { consumer: "client" | "server" } } | undefined) =>
  env?.config.consumer === "client";
const SERVER_TEMPORAL = `const Temporal = globalThis.Temporal;
if (!Temporal)
  throw new Error('void-fbtee: no Temporal on the server. Add Cloudflare\\'s "temporal" compatibility flag (void.config.ts: worker.compatibility_flags), or run void-fbtee init.');
export { Temporal };
export const Intl = globalThis.Intl;
export const toTemporalInstant = Date.prototype.toTemporalInstant;
`;

// Void builds the browser and the worker as separate Vite builds, each with its own copy of the
// plugin; report once per app and command in this process.
const reportedRuns = new Set<string>();

export function voidFbtee(options: VoidFbteeOptions): Plugin[] {
  const config: LocaleConfig = resolveLocales(options.sourceLocale, options.locales);
  if (options.site !== undefined) checkSite(options.site);
  const translationsDir = options.translations ?? DEFAULT_TRANSLATIONS;
  const src = options.src ?? DEFAULT_SRC;
  const require = createRequire(import.meta.url);
  // fbtee's own exports: index.mjs for "default"; index-server.mjs beside it.
  const fbteeServer = require.resolve("fbtee").replace(/index\.mjs$/, "index-server.mjs");
  let root = process.cwd();
  let command: "build" | "serve" = "serve";
  let devServer: ViteDevServer | undefined;
  // Whether the app uses @void/md, as void-md tells its own adapters (by plugin name): no peer
  // dependency on it, which an app without markdown pages would have to install anyway.
  let hasMarkdown = false;
  // Whether this is the server Vitest makes to run tests, which run in Node.js: no Worker, so no
  // Cloudflare Temporal, and `temporal-polyfill` stays the polyfill. Recognised as Void 1.8.0's
  // isVitestServer does (src/plugin-dev-config.ts): Vitest adds plugins named "vitest" and
  // "vitest:*".
  let underVitest = false;
  const project = (): Project => ({
    root,
    config,
    translations: translationsDir,
    src,
    common: options.common,
  });

  const api: VoidFbteeApi = { options, project };

  const core: Plugin = {
    name: "void-fbtee",
    enforce: "pre",
    api,
    configResolved(resolved) {
      root = resolved.root;
      command = resolved.command;
      hasMarkdown = resolved.plugins.some((p) => p.name === "void-md");
      underVitest = resolved.plugins.some(
        (p) => p.name === "vitest" || p.name.startsWith("vitest:"),
      );
    },
    // Once per run (the first environment to start): the dev server warns, a build reports, and
    // with failOnMissing a build fails, so `void deploy` (which runs `vite build`) can't ship gaps.
    buildStart() {
      const run = `${root}|${command}`;
      if (reportedRuns.has(run)) return;
      reportedRuns.add(run);
      const report = formatMissing(missing(project()));
      if (!report) return;
      if (command === "build" && options.failOnMissing)
        this.error(`void-fbtee: untranslated strings (failOnMissing is on):\n${report}`);
      this.warn(`untranslated strings (they show in ${config.sourceLocale}):\n${report}`);
    },
    configureServer(server) {
      devServer = server;
      server.watcher.add(join(root, translationsDir));
    },
    // Vite calls this for every watched file event, once per environment; act once (client).
    // A hook rather than watcher listeners: Vite, Void and Cloudflare's plugin already put Node
    // near its 10-listener warning on the watcher.
    watchChange(file, { event }) {
      const dir = join(root, translationsDir);
      if (!devServer || !isClient(this.environment) || !file.startsWith(dir)) return;
      // A catalog added or removed: the virtual catalog modules change, so reload. An edit is a
      // normal hot update (the file is a watched dependency of its catalog module).
      if (event !== "update") {
        for (const env of Object.values(devServer.environments)) {
          for (const l of config.locales) {
            const mod = env.moduleGraph.getModuleById("\0" + CATALOG_PREFIX + l.locale);
            if (mod) env.moduleGraph.invalidateModule(mod);
          }
        }
        devServer.ws.send({ type: "full-reload" });
      }
      const report = formatMissing(missing(project()));
      devServer.config.logger.info(
        report
          ? `void-fbtee: untranslated strings:\n${report}`
          : "void-fbtee: all strings translated",
      );
    },
    configEnvironment(name, env) {
      // The virtual modules must reach void-fbtee's own files, so it is never pre-bundled.
      // Its own imports are then not scanned, so the browser's are listed here; otherwise Vite
      // finds them on the first page load and reloads mid-page (504 "Outdated Optimize Dep").
      // void/pages-server: Void's island wrapper imports it in the browser and Void 1.7.0 doesn't
      // list it, so the first island page after a cold start hit the same reload.
      // Vite's own default: an environment is the browser's only if it's "client" or says so.
      if ((env.consumer ?? (name === "client" ? "client" : "server")) === "client") {
        return {
          optimizeDeps: {
            exclude: ["void-fbtee"],
            include: ["fbtee", "temporal-polyfill", "void/pages-server"],
          },
        };
      }
      return {
        optimizeDeps: { exclude: ["fbtee", "void-fbtee"], include: ["fbtee > invariant"] },
      };
    },
    resolveId: {
      filter: { id: RESOLVE_FILTER },
      async handler(id) {
        if (
          id === CONFIG_ID ||
          id === CATALOGS_ID ||
          id === TEXTS_ID ||
          id === MD_PAGES_ID ||
          id === ZOD_ID ||
          id === PAGES_ID ||
          id.startsWith(CATALOG_PREFIX)
        )
          return "\0" + id;
        if (isClient(this.environment)) return;
        if (id === "fbtee/server") return fbteeServer;
        if (id === "temporal-polyfill" && !underVitest) return SERVER_TEMPORAL_ID;
        if (id === HONO_ROUTE_ID) {
          const voidEntry = await this.resolve("void", join(root, "package.json"));
          const route = voidEntry && (await this.resolve("hono/route", voidEntry.id));
          if (!route) throw new Error("void-fbtee: can't find Hono's route helper beside Void.");
          return route;
        }
      },
    },
    transform: {
      filter: { id: { include: /\.[jt]sx?$/, exclude: /node_modules|^\0/ }, code: /fbt|fbs/ },
      handler(code, id) {
        if (!isClient(this.environment) || !id.startsWith(root)) return;
        // Appended: imports run before the module body wherever they are, and line numbers stay put.
        return { code: `${code}\nimport "void-fbtee/client";`, map: null };
      },
    },
    load: {
      filter: { id: LOAD_FILTER },
      handler(id) {
        if (id === SERVER_TEMPORAL_ID) return SERVER_TEMPORAL;
        if (id === "\0" + CONFIG_ID)
          return `export default ${JSON.stringify({ ...config, fallbackLocales: options.fallbackLocales, site: options.site })};`;
        if (id === "\0" + CATALOGS_ID) {
          const entries = translatedOf(config).map(
            (l) =>
              `${JSON.stringify(l.locale)}: () => import(${JSON.stringify(CATALOG_PREFIX + l.locale)})`,
          );
          return `export default {${entries.join(",")}};`;
        }
        // @void/md's pages list exists only inside its plugin, so it's re-exported only when the
        // app has it.
        if (id === "\0" + MD_PAGES_ID)
          return hasMarkdown ? `export { default } from "@void/md/pages";` : "export default [];";
        if (id === "\0" + ZOD_ID) return zodMessages(root, config);
        if (id === "\0" + PAGES_ID) {
          const file = join(root, ".void/routes.d.ts");
          if (existsSync(file)) this.addWatchFile(file);
          return `export default ${JSON.stringify(langPages(file))};`;
        }
        // Dev only: each string's source text, so the browser can name what it shows untranslated.
        if (id === "\0" + TEXTS_ID)
          return `export default ${command === "serve" ? JSON.stringify(runtimeTexts(project())) : "{}"};`;
        if (id.startsWith("\0" + CATALOG_PREFIX)) {
          const locale = id.slice(1 + CATALOG_PREFIX.length);
          const file = catalogFile(project(), locale);
          // A locale with no translations file yet gets an empty catalog. Only existing files are
          // watched: in the browser build Vite turns watch files into imports. A new file is picked
          // up by the folder watcher in configureServer.
          if (!existsSync(file)) return `export default {};`;
          this.addWatchFile(file);
          for (const f of collect(project()).files) this.addWatchFile(f);
          return `export default ${JSON.stringify({ [locale]: runtimeCatalog(project(), locale) })};`;
        }
      },
    },
  };

  return [core, fbteeVite({ fbtCommon: options.common })];
}

/**
 * The pages under pages/[lang]/ with no parameter but the language ("/[lang]/docs"), from Void's
 * generated route types: PagePathMap's entries whose parameters are exactly "lang". Void writes the
 * file on install (`void prepare`) and whenever the pages change; none yet, none listed.
 */
export function langPages(file: string): string[] {
  if (!existsSync(file)) return [];
  const block = /export interface PagePathMap \{([\s\S]*?)\n\s*\}/.exec(readFileSync(file, "utf8"));
  return [...(block?.[1] ?? "").matchAll(/^\s*"(\/\[lang\][^"]*)": "lang";$/gm)].map((m) => m[1]!);
}

/**
 * virtual:void-fbtee/zod: `setup(currentLocale)` sets Zod's `localeError` to the message set of the
 * language `currentLocale()` gives (a locale's own, "pt-BR", else its language's, "th" for
 * "th-TH"), English where Zod has none. Without Zod 4 in the app, a `setup` that does nothing.
 */
function zodMessages(root: string, config: LocaleConfig): string {
  const none = "export function setup() {}";
  let dir: string;
  try {
    const pkg = createRequire(join(root, "package.json")).resolve("zod/package.json");
    if (Number(JSON.parse(readFileSync(pkg, "utf8")).version.split(".")[0]) < 4) return none;
    dir = join(pkg, "../v4/locales");
  } catch {
    return none;
  }
  const has = (name: string) => existsSync(join(dir, `${name}.js`));
  const found = config.locales.flatMap((l) => {
    const name = [l.locale, new Intl.Locale(l.locale).language].find(has);
    return name ? [[l.locale, name] as const] : [];
  });
  return [
    `import { config } from "zod/v4/core";`,
    `import en from "zod/v4/locales/en.js";`,
    ...found.map(
      ([, name], i) => `import l${i} from ${JSON.stringify(`zod/v4/locales/${name}.js`)};`,
    ),
    `const sets = { ${found.map(([locale], i) => `${JSON.stringify(locale)}: l${i}().localeError`).join(", ")} };`,
    `const fallback = en().localeError;`,
    `export function setup(currentLocale) {`,
    `  config({ localeError: (issue) => (sets[currentLocale()] ?? fallback)(issue) });`,
    `}`,
  ].join("\n");
}
