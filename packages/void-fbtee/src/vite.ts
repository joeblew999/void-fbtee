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
//   source, as the virtual module `virtual:void-fbtee/catalogs`. Nothing generated goes in git. (5)
// - Browser: every app module that uses <fbt> or fbs first imports `void-fbtee/client`, which
//   installs the page's catalog (top-level await). Islands hydrate without the layout's
//   I18nProvider, so this is what gives them their strings. (30)
import { createRequire } from "node:module";
import { globSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";
import fbteeVite from "@nkzw/vite-plugin-fbtee";
import { collectBatchSync, translateSync } from "@nkzw/fbtee-compiler";
import { resolveLocales, type LocaleConfig, type LocaleInput } from "./locales";

export interface VoidFbteeOptions {
  /** The language the app's <fbt> strings are written in, e.g. "en-US". */
  sourceLocale: string;
  /** Every locale the app serves, the source locale included. */
  locales: LocaleInput[];
  /** Folder of editable translation files, one <locale>.json each. Default "i18n/translations". */
  translations?: string;
  /** Source files to collect strings from. */
  src?: string[];
}

const DEFAULT_SRC = [
  "pages/**/*.{ts,tsx,js,jsx}",
  "components/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}",
  "routes/**/*.{ts,tsx,js,jsx}",
  "src/**/*.{ts,tsx,js,jsx}",
];

const langOf = (file: string) =>
  file.endsWith(".tsx")
    ? "tsx"
    : file.endsWith(".ts")
      ? "ts"
      : file.endsWith(".jsx")
        ? "jsx"
        : "js";

const CONFIG_ID = "virtual:void-fbtee/config";
const CATALOGS_ID = "virtual:void-fbtee/catalogs";
const CATALOG_PREFIX = "virtual:void-fbtee/catalog/";

export default function voidFbtee(options: VoidFbteeOptions): Plugin[] {
  const config: LocaleConfig = resolveLocales(options.sourceLocale, options.locales);
  const translationsDir = options.translations ?? "i18n/translations";
  const src = options.src ?? DEFAULT_SRC;
  const require = createRequire(import.meta.url);
  // fbtee's own exports: index.mjs for "default"; index-server.mjs beside it.
  const fbteeServer = require.resolve("fbtee").replace(/index\.mjs$/, "index-server.mjs");
  let root = process.cwd();

  const sourceFiles = () =>
    globSync(src, { cwd: root, exclude: (p) => p.includes("node_modules") })
      .map((f) => join(root, f))
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return text.includes("fbt") || text.includes("fbs");
      });

  const core: Plugin = {
    name: "void-fbtee",
    enforce: "pre",
    configResolved(resolved) {
      root = resolved.root;
    },
    configureServer(server) {
      const dir = join(root, translationsDir);
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!file.startsWith(dir)) return;
        for (const env of Object.values(server.environments)) {
          for (const l of config.locales) {
            const mod = env.moduleGraph.getModuleById("\0" + CATALOG_PREFIX + l.locale);
            if (mod) env.moduleGraph.invalidateModule(mod);
          }
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
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
      if (id === CONFIG_ID || id === CATALOGS_ID || id.startsWith(CATALOG_PREFIX)) return "\0" + id;
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
      if (id === "\0" + CONFIG_ID) return `export default ${JSON.stringify(config)};`;
      if (id === "\0" + CATALOGS_ID) {
        const entries = config.locales
          .filter((l) => l.locale !== config.sourceLocale)
          .map(
            (l) =>
              `${JSON.stringify(l.locale)}: () => import(${JSON.stringify(CATALOG_PREFIX + l.locale)})`,
          );
        return `export default {${entries.join(",")}};`;
      }
      if (id.startsWith("\0" + CATALOG_PREFIX)) {
        const locale = id.slice(1 + CATALOG_PREFIX.length);
        const file = join(root, translationsDir, `${locale}.json`);
        // A locale with no translations file yet gets an empty catalog. Only existing files are
        // watched: in the browser build Vite turns watch files into imports. A new file is picked
        // up by the folder watcher in configureServer.
        if (!existsSync(file)) return `export default {};`;
        this.addWatchFile(file);
        const files = sourceFiles();
        for (const f of files) this.addWatchFile(f);
        // Each file is parsed by its own extension, as fbtee's Vite plugin does: a .ts file with
        // an old-style `<T>value` cast would be misread as JSX under "tsx".
        const phrases: unknown[] = [];
        for (const lang of ["tsx", "ts", "jsx", "js"] as const) {
          const batch = files.filter((f) => langOf(f) === lang);
          if (!batch.length) continue;
          const collected = collectBatchSync(
            batch.map((f) => ({
              filename: relative(root, f),
              sourceText: readFileSync(f, "utf8"),
            })),
            { lang, collectPackager: "text" },
          );
          if (collected.errors.length) {
            this.error(
              `void-fbtee: collecting strings failed: ${collected.errors.map((e) => e.message).join("; ")}`,
            );
          }
          phrases.push(...(JSON.parse(collected.output ?? "{}").phrases ?? []));
        }
        const group = JSON.parse(readFileSync(file, "utf8"));
        const table = JSON.parse(
          translateSync(JSON.stringify({ phrases, translationGroups: [group] }), true),
        );
        return `export default ${JSON.stringify({ [locale]: table[locale] ?? {} })};`;
      }
    },
  };

  return [core, fbteeVite()];
}
