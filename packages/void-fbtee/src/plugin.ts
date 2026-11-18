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
//   goes in git. catalogs.ts.
// - `vp dev` does the translation work: on start and on each save it prepares the catalogs (a new
//   string is in each, marked new), then at once translates what's new: with Void's AI when the
//   app has it (its own Worker, through a route only `vp dev` has: ai.ts), then Claude Code for
//   anything left (`claude -p` when it's signed in, else its prompt: translate.ts); it records
//   each page the agent marks done, and it reports everything `check` finds.
// - `vp build` fails on anything `check` finds, so `void deploy` (which builds) can't ship gaps.
// - Browser: every app module that uses <fbt> or fbs first imports `void-fbtee/client`, which
//   installs the page's catalog (top-level await). Islands hydrate without the layout's
//   I18nProvider, so this is what gives them their strings.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, matchesGlob, relative, sep } from "node:path";
import { prepare } from "./commands";
import {
  hasClaude,
  agentProvenance,
  appName,
  markedDone,
  reviewApp,
  stamp,
  translateApp,
  translateWithVoidAi,
  waitingReview,
} from "./translate";
import { check, reopenFailing } from "./check";
import { writeContentFiles } from "./content-files";
import type { Plugin, ViteDevServer } from "vite";
import fbteeVite from "@nkzw/vite-plugin-fbtee";
import type { FallbackLocales } from "fbtee";
import { resolveLocales, sourceOf, type LocaleConfig, type LocaleInput } from "./locales";
import {
  DEFAULT_SRC,
  DEFAULT_TRANSLATIONS,
  catalogFile,
  catalogLocales,
  collect,
  missing,
  runtimeCatalog,
  runtimeTexts,
  type Project,
} from "./catalogs";
import { checkSite } from "./site";

/** How long the dev server waits after the last save before preparing (milliseconds): saves
 * that come together, as an editor's "save all" does, prepare once. Translating follows the
 * prepare at once: the developer doesn't pause for it. */
const PREPARE_DELAY = 300;

/** voidFbtee({ fallbackLocale }), canonical and one of the app's, or the source language. */
function checkFallback(fallback: string | undefined, config: LocaleConfig): string {
  if (fallback === undefined) return config.sourceLocale;
  const locale = Intl.getCanonicalLocales(fallback)[0]!;
  if (!config.locales.some((l) => l.locale === locale))
    throw new Error(`void-fbtee: fallbackLocale "${fallback}" is not in locales.`);
  return locale;
}

/** voidFbtee({ content }), each table with its fields and what it holds (content.ts ContentTable). */
export function contentOf(
  options: Pick<VoidFbteeOptions, "content">,
): Record<string, { fields: string[]; about: string }> {
  return Object.fromEntries(
    Object.entries(options.content ?? {}).map(([table, v]) => [
      table,
      Array.isArray(v)
        ? { fields: v, about: table }
        : { fields: v.fields, about: v.about ?? table },
    ]),
  );
}

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
   * fbtee's own `fallbackLocales` option, passed to fbtee as is: catalogs to try after a
   * locale's natural parents (de-AT -> de) and before the source text. See fbtee's README,
   * "Locale Matching and Fallback".
   */
  fallbackLocales?: FallbackLocales;
  /**
   * The language for a visitor none of whose languages the app has (a French browser on an English
   * and Thai site), and for one whose browser names none (a crawler): where `"/"` sends them, and
   * every page's hreflang `x-default`. One of `locales`. Default: `sourceLocale`, as fbtee's own
   * `fallbackLocale` (fbtee's README, "Locale Matching and Fallback").
   */
  fallbackLocale?: string;
  /**
   * `"/"` sends each visitor to their own language (`Accept-Language`, by fbtee's rule). Default
   * true. False for an app with its own page at `"/"`.
   */
  redirectHome?: boolean;
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
  /**
   * What people write in the app's tables, to translate into its languages
   * (plans/translated-content.md): each table, with its fields, and optionally what it holds,
   * for the model ("listings for events"). E.g. { events: ["title", "description"] } or
   * { events: { fields: ["title", "description"], about: "listings for events" } }. Each table
   * has a text `id` and a `locale` column; its translations are in `<table>_translations`
   * (translationsOf from void-fbtee/db/schema).
   */
  content?: Record<string, string[] | { fields: string[]; about?: string }>;
}

/** What the plugin exposes on its `api`, read from the config without running the plugin (loadProject, for tests). */
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
/** `vp dev` only: the dev server's route for translating with Void's AI (ai.ts devTranslate). */
const DEV_ID = "virtual:void-fbtee/dev";
// What the middleware asks for a row a page read in a language it lacks with: the package's
// translateSoon when the app has voidFbtee({ content }), else nothing, so an app without content
// doesn't bundle void/db and void/queues (content.ts).
const CONTENT_ASK_ID = "virtual:void-fbtee/content-ask";
export const DEV_TRANSLATE_PATH = "/__void-fbtee/translate";
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
  throw new Error('void-fbtee: no Temporal on the server. Add Cloudflare\\'s "temporal" compatibility flag (void.config.ts: worker.compatibility_flags), or run vp exec void-fbtee init.');
export { Temporal };
export const Intl = globalThis.Intl;
export const toTemporalInstant = Date.prototype.toTemporalInstant;
`;

export function voidFbtee(options: VoidFbteeOptions): Plugin[] {
  const config: LocaleConfig = resolveLocales(options.sourceLocale, options.locales);
  if (options.site !== undefined) checkSite(options.site);
  const fallbackLocale = checkFallback(options.fallbackLocale, config);
  const translationsDir = options.translations ?? DEFAULT_TRANSLATIONS;
  const src = options.src ?? DEFAULT_SRC;
  const require = createRequire(import.meta.url);
  // fbtee's own exports: index.mjs for "default"; index-server.mjs beside it.
  const fbteeServer = require.resolve("fbtee").replace(/index\.mjs$/, "index-server.mjs");
  let root = process.cwd();
  let command: "build" | "serve" = "serve";
  let devServer: ViteDevServer | undefined;
  // What the dev server's translate route answers to: made fresh each run, never in a build.
  const devToken = randomUUID();
  let prepareTimer: ReturnType<typeof setTimeout> | undefined;
  let translateTimer: ReturnType<typeof setTimeout> | undefined;
  // One translation at a time; a save during one asks for another after it.
  let translating: Promise<void> | undefined;
  let translateAgain = false;
  // The prompt last shown for a coding agent, so the next save doesn't show it again.
  let handedOut: string | undefined;
  // The review prompt last shown, likewise.
  let reviewHandedOut: string | undefined;
  const log = (text: string) =>
    text.split("\n").forEach((l) => devServer?.config.logger.info(`void-fbtee: ${l}`));
  // What Claude Code was given to translate, by language (each string's text): when it's done,
  // the log says so, so it's clear which translations are Claude's.
  const withClaude = new Map<string, Set<string>>();
  const openNow = () => new Map(missing(project()).map((m) => [m.locale, new Set(m.app)] as const));
  const byLanguage = (by: Map<string, Set<string>>) =>
    [...by]
      .filter(([, s]) => s.size)
      .map(([locale, s]) => `${locale} ${s.size}`)
      .join(", ");
  const count = (by: Map<string, Set<string>>) => [...by.values()].reduce((n, s) => n + s.size, 0);
  const report = (problems: string[]) => {
    if (count(withClaude)) {
      const open = openNow();
      const done = new Map(
        [...withClaude].map(
          ([locale, texts]) =>
            [locale, new Set([...texts].filter((t) => !open.get(locale)?.has(t)))] as const,
        ),
      );
      if (count(done)) log(`Claude Code translated ${count(done)} strings (${byLanguage(done)})`);
      for (const [locale, texts] of done) for (const t of texts) withClaude.get(locale)?.delete(t);
    }
    log(
      problems.length
        ? `${problems.length} to fix:\n${problems.join("\n")}`
        : "all translated, nothing to fix",
    );
    const waiting = waitingReview(project());
    if (waiting) log(`not yet reviewed by Claude: ${waiting}`);
  };
  // Tests (Vitest's server, CI) don't start an agent: they report.
  const agentAllowed = () => !underVitest && !process.env.CI;
  // After a save, straight after its prepare: translate what's new (a source file or original page saved), or
  // only report (a catalog or translated page saved, which is the translating itself).
  let translateWanted = false;
  const translateSoon = (translate = true) => {
    translateWanted ||= translate;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => {
      const wanted = translateWanted;
      translateWanted = false;
      if (translating) {
        // The agent's own edits, while it works: it reports when it's done.
        if (!wanted) return;
        translateAgain = true;
        return;
      }
      if (!wanted || !agentAllowed()) return report(check(project()));
      // Void's AI first, the one translator (models.ts: Gemini 3.5 Flash, as at runtime), through
      // the dev server's own route, when the app has it. Then Claude Code for anything left (what
      // didn't pass the checks, or everything when Void's AI isn't there): `claude -p` when it's
      // signed in here, otherwise its prompt, for whatever coding agent the developer uses.
      const base = devServer?.resolvedUrls?.local[0];
      const url = base && new URL(DEV_TRANSLATE_PATH, base).href;
      // A finished translation the checks now fail (a catalog from before they were stricter) is
      // translated again, not left for the build to fail on (check.ts reopenFailing).
      const reopened = reopenFailing(project());
      if (reopened.length)
        log(
          `${reopened.length} finished translations fail the checks, so they're translated again:\n${reopened.join("\n")}`,
        );
      // Who translates, said before they start.
      const open = openNow();
      if (count(open))
        log(
          `translating ${count(open)} new strings (${byLanguage(open)}) with ${
            url
              ? "Void's AI, then Claude Code for anything left"
              : "nobody here: no Void's AI; Claude Code, or the prompt below for your coding agent"
          }`,
        );
      translating = (
        url ? translateWithVoidAi(project(), url, devToken, log) : Promise.resolve(false)
      )
        .catch((error) => {
          log(`Void's AI couldn't translate: ${String(error)}`);
          return false;
        })
        .then(() => {
          // What Claude Code is given: whatever Void's AI left.
          if (hasClaude())
            for (const [locale, texts] of openNow())
              for (const t of texts) {
                if (!withClaude.has(locale)) withClaude.set(locale, new Set());
                withClaude.get(locale)!.add(t);
              }
          return translateApp(project(), root, log, handedOut);
        })
        .then(async (result) => {
          handedOut = result.prompt;
          // Then Claude reviews what the AI wrote (step 6 of plans/translation-rework.md), once
          // nothing is left to translate: a review of half a catalog would be done twice.
          if (result.prompt) return report(result.problems);
          const reviewed = await reviewApp(project(), root, log, reviewHandedOut);
          reviewHandedOut = reviewed.prompt;
          report(reviewed.problems);
        })
        .catch((error) => log(`couldn't translate: ${String(error)}`))
        .finally(() => {
          translating = undefined;
          if (translateAgain) {
            translateAgain = false;
            translateSoon();
          }
        });
    }, 0);
  };
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
    redirectHome: options.redirectHome ?? true,
    content: contentOf(options),
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
    // A build fails on anything check finds (untranslated strings, pages, setup, a removed
    // language's leftovers), so `void deploy`, which builds, can't ship gaps. Each environment's
    // build checks (Void builds the browser and the worker separately): the first one fails.
    buildStart() {
      if (command !== "build") return;
      const problems = check(project());
      // Not a failure (CI has no Claude), but said: what no one has looked at yet.
      const waiting = waitingReview(project());
      if (waiting) this.info(`void-fbtee: machine translations not yet reviewed: ${waiting}`);
      if (problems.length)
        this.error(
          `void-fbtee: ${problems.length} to fix before this can build (vp dev translates them):\n${problems.join("\n")}`,
        );
    },
    configureServer(server) {
      devServer = server;
      server.watcher.add(join(root, translationsDir));
      // Once as it starts, as on every save: a language just added to the app's list (the dev
      // server restarts when its config changes) gets its catalog, with every string marked new,
      // then everything that isn't translated is, once the start has settled.
      try {
        const written = prepare(project());
        if (written.length) log(`prepared ${written.join(", ")}`);
      } catch (error) {
        server.config.logger.warn(`void-fbtee: couldn't prepare: ${String(error)}`);
      }
      // voidFbtee({ content }): the app's few files for it, at Void's places, where they're
      // missing (content-files.ts); never over the app's own. Void rescans queues and jobs as files
      // change.
      try {
        const written = writeContentFiles(project());
        if (written.length)
          log(
            `wrote ${written.join(", ")} for voidFbtee({ content }); a new table needs its migration: vp exec void db generate`,
          );
      } catch (error) {
        server.config.logger.warn(`void-fbtee: couldn't write the content files: ${String(error)}`);
      }
      // The route's token, where the measurement of translators reads it (scripts/translator.ts),
      // as Void keeps its own dev trigger token in a file (.void/dev-trigger-token).
      try {
        const dir = join(root, "node_modules/.void-fbtee");
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "dev-token"), devToken);
      } catch {}
      // Once it's listening: Void's AI is reached through the dev server's own address.
      if (server.httpServer) server.httpServer.once("listening", () => translateSoon());
      else translateSoon();
    },
    // Vite calls this for every watched file event, once per environment; act once (client).
    // A hook rather than watcher listeners: Vite, Void and Cloudflare's plugin already put Node
    // near its 10-listener warning on the watcher.
    watchChange(file, { event }) {
      const dir = join(root, translationsDir);
      if (!devServer || !isClient(this.environment)) return;
      const rel = relative(root, file).split(sep).join("/");
      if (rel.startsWith("..")) return;
      // A markdown page the agent marked done: record which version of the original it's from.
      // That write is another save, which then finds the page recorded.
      if (/\.mdx?$/.test(file) && event !== "delete" && existsSync(file)) {
        try {
          const text = readFileSync(file, "utf8");
          if (markedDone(text)) {
            stamp(project(), file, agentProvenance(text));
            log(`recorded ${rel}`);
            return;
          }
        } catch (error) {
          log(`couldn't record ${rel}: ${String(error)}`);
        }
      }
      const source = !file.startsWith(dir) && src.some((glob) => matchesGlob(rel, glob));
      if (file.startsWith(dir)) {
        // A catalog added or removed: the virtual catalog modules change, so reload. An edit is
        // a normal hot update (the file is a watched dependency of its catalog module).
        if (event !== "update") {
          for (const env of Object.values(devServer.environments)) {
            for (const l of config.locales) {
              const mod = env.moduleGraph.getModuleById("\0" + CATALOG_PREFIX + l.locale);
              if (mod) env.moduleGraph.invalidateModule(mod);
            }
          }
          devServer.ws.send({ type: "full-reload" });
        }
      } else if (source) {
        // A source file saved: prepare (fbtee's collect and prepare-translations), so a new
        // string is in every catalog, marked new, at once. Waits for saves to settle; writes
        // only catalogs that change (commands.ts).
        clearTimeout(prepareTimer);
        prepareTimer = setTimeout(() => {
          try {
            const written = prepare(project());
            if (written.length) log(`prepared ${written.join(", ")}: translating`);
          } catch (error) {
            devServer?.config.logger.warn(`void-fbtee: couldn't prepare: ${String(error)}`);
          }
          // Then at once: translate what's new.
          translateSoon(true);
        }, PREPARE_DELAY);
        return;
      } else if (!/\.mdx?$/.test(file) || !rel.startsWith("pages/")) return;
      // A markdown page saved: translate what's new (an original page), or report what's left.
      const original = `pages/${sourceOf(config).segment}/`;
      translateSoon(rel.startsWith(original));
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
          id === DEV_ID ||
          id === CONTENT_ASK_ID ||
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
      async handler(id) {
        if (id === SERVER_TEMPORAL_ID) return SERVER_TEMPORAL;
        if (id === "\0" + CONFIG_ID)
          return `export default ${JSON.stringify({ ...config, fallbackLocale, redirectHome: options.redirectHome ?? true, fallbackLocales: options.fallbackLocales, site: options.site, content: contentOf(options), app: appName(root) })};`;
        if (id === "\0" + CATALOGS_ID) {
          // The translated languages, and the source's own when it needs one (catalogs.ts).
          const entries = catalogLocales(project()).map(
            (locale) =>
              `${JSON.stringify(locale)}: () => import(${JSON.stringify(CATALOG_PREFIX + locale)})`,
          );
          return `export default {${entries.join(",")}};`;
        }
        // @void/md's pages list exists only inside its plugin, so it's re-exported only when the
        // app has it.
        if (id === "\0" + MD_PAGES_ID)
          return hasMarkdown ? `export { default } from "@void/md/pages";` : "export default [];";
        if (id === "\0" + ZOD_ID) {
          // Found as the bundler finds it: Node's require would also look in NODE_PATH, which
          // `pnpm exec` sets to every package pnpm installed, the app's or not.
          const core = await this.resolve("zod/v4/core", join(root, "package.json"));
          return zodMessages(root, Boolean(core && !core.external), config);
        }
        if (id === "\0" + CONTENT_ASK_ID)
          return Object.keys(contentOf(options)).length
            ? `export { translateSoon } from "void-fbtee/content";`
            : "export const translateSoon = undefined;";
        // The route exists only under `vp dev`, on the server, and answers only the dev server.
        if (id === "\0" + DEV_ID)
          return command === "serve" && !isClient(this.environment)
            ? `import { devTranslate } from "void-fbtee/ai";\nexport default { path: ${JSON.stringify(DEV_TRANSLATE_PATH)}, handle: (r) => devTranslate(r, ${JSON.stringify(devToken)}) };`
            : "export default undefined;";
        if (id === "\0" + PAGES_ID) {
          const file = join(root, ".void/routes.d.ts");
          if (existsSync(file)) this.addWatchFile(file);
          return `export default ${JSON.stringify(langPages(file))};`;
        }
        // Each string's source text, so a missing translation can be named: on the server always
        // (its log is where production shows them), in the browser only in dev (no page ships the
        // whole app's text to visitors).
        if (id === "\0" + TEXTS_ID)
          return `export default ${command === "serve" || !isClient(this.environment) ? JSON.stringify(runtimeTexts(project())) : "{}"};`;
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
function zodMessages(root: string, inApp: boolean, config: LocaleConfig): string {
  const none = "export function setup() {}";
  if (!inApp) return none;
  // Where it is, by Node (in dev, Vite resolves it to its optimized copy). zod/v4/core is in
  // Zod 3.25 too; the package's own version says which Zod the app has.
  let pkg: string;
  try {
    pkg = dirname(createRequire(join(root, "package.json")).resolve("zod/package.json"));
  } catch {
    return none;
  }
  if (Number(JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version.split(".")[0]) < 4)
    return none;
  const dir = join(pkg, "v4/locales");
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
