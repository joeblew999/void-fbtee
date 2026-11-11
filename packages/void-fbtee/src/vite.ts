// The void-fbtee Vite plugin. Put it first in the app's vite.config.ts plugins.
//
// What it does, and why (plan: joeblew999/void-fbtee#1):
// - Runs fbtee's own Vite plugin, which compiles <fbt> and fbs.
// - Server environments: resolves `fbtee/server` to fbtee's per-request (AsyncLocalStorage) build.
//   fbtee only exports it under the `node` condition, and workerd isn't `node`. (decision 1)
// - Server environments don't pre-bundle fbtee, so `fbtee` and `fbtee/server` share one core. (2)
// - Server environments resolve `temporal-polyfill` to the polyfill's own code, never
//   "native if present": Cloudflare's native Temporal once shipped broken (workerd#6907). (12)
// - Builds each locale's catalog in-process from i18n/translations/<locale>.json and the app's
//   source (plus fbtee's built-in strings), as `virtual:void-fbtee/catalogs`. Nothing generated
//   goes in git. (5) Shared with the void-fbtee command: catalogs.ts.
// - Reports untranslated strings once per run: a warning in dev, a report in a build, and with
//   `failOnMissing` a failed build, so `void deploy` (which runs `vite build`) can't ship gaps.
// - Browser: every app module that uses <fbt> or fbs first imports `void-fbtee/client`, which
//   installs the page's catalog (top-level await). Islands hydrate without the layout's
//   I18nProvider, so this is what gives them their strings. (30)
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import fbteeVite from "@nkzw/vite-plugin-fbtee";
import type { FallbackLocales } from "fbtee";
import { resolveLocales, type LocaleConfig, type LocaleInput } from "./locales";
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

export interface VoidFbteeOptions {
  /** The language the app's <fbt> strings are written in, e.g. "en-US". */
  sourceLocale: string;
  /** Every locale the app serves, the source locale included. */
  locales: LocaleInput[];
  /** Folder of editable translation files, one <locale>.json each. Default "i18n/translations". */
  translations?: string;
  /** Source files to collect strings from. */
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

// Void builds the browser and the worker as separate Vite builds, each with its own copy of the
// plugin; report once per app and command in this process.
const reportedRuns = new Set<string>();

export default function voidFbtee(options: VoidFbteeOptions): Plugin[] {
  const config: LocaleConfig = resolveLocales(options.sourceLocale, options.locales);
  const translationsDir = options.translations ?? DEFAULT_TRANSLATIONS;
  const src = options.src ?? DEFAULT_SRC;
  const require = createRequire(import.meta.url);
  // fbtee's own exports: index.mjs for "default"; index-server.mjs beside it.
  const fbteeServer = require.resolve("fbtee").replace(/index\.mjs$/, "index-server.mjs");
  let root = process.cwd();
  let command: "build" | "serve" = "serve";
  let devServer: ViteDevServer | undefined;
  const project = (): Project => ({ root, config, translations: translationsDir, src });

  const api: VoidFbteeApi = { options, project };

  const core: Plugin = {
    name: "void-fbtee",
    enforce: "pre",
    api,
    configResolved(resolved) {
      root = resolved.root;
      command = resolved.command;
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
      if (!devServer || this.environment?.name !== "client" || !file.startsWith(dir)) return;
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
    configEnvironment(name) {
      // The virtual modules must reach void-fbtee's own files, so it is never pre-bundled.
      // Its own imports are then not scanned, so the browser's are listed here; otherwise Vite
      // finds them on the first page load and reloads mid-page (504 "Outdated Optimize Dep").
      // void/pages-server: Void's island wrapper imports it in the browser and Void 1.7.0 doesn't
      // list it, so the first island page after a cold start hit the same reload.
      if (name === "client") {
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
    async resolveId(id) {
      if (
        id === CONFIG_ID ||
        id === CATALOGS_ID ||
        id === TEXTS_ID ||
        id.startsWith(CATALOG_PREFIX)
      )
        return "\0" + id;
      if (this.environment.name === "client") return;
      if (id === "fbtee/server") return fbteeServer;
      if (id === "temporal-polyfill") {
        return this.resolve("temporal-polyfill/implementation", undefined, { skipSelf: true });
      }
    },
    transform: {
      filter: { id: { include: /\.[jt]sx?$/, exclude: /node_modules|^\0/ }, code: /fbt|fbs/ },
      handler(code, id) {
        if (this.environment.name !== "client" || !id.startsWith(root)) return;
        // Appended: imports run before the module body wherever they are, and line numbers stay put.
        return { code: `${code}\nimport "void-fbtee/client";`, map: null };
      },
    },
    load(id) {
      if (id === "\0" + CONFIG_ID)
        return `export default ${JSON.stringify({ ...config, fallbackLocales: options.fallbackLocales })};`;
      if (id === "\0" + CATALOGS_ID) {
        const entries = config.locales
          .filter((l) => l.locale !== config.sourceLocale)
          .map(
            (l) =>
              `${JSON.stringify(l.locale)}: () => import(${JSON.stringify(CATALOG_PREFIX + l.locale)})`,
          );
        return `export default {${entries.join(",")}};`;
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
  };

  return [core, fbteeVite()];
}
