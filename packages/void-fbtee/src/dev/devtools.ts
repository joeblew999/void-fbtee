// void-fbtee in Vite DevTools (https://devtools.vite.dev, DevTools Kit 0.8.3, read 2026-11-20): a
// panel with each language's state, what `vp build` would stop on, the translated pages and the
// translators; buttons and palette commands to prepare, translate and check now; the translators'
// output as a DevTools terminal; and a message when something would stop the build.
//
// Only when the app turns DevTools on (`@vitejs/devtools` installed, `devtools: true` in its Vite
// config): the plugin's `devtools.setup` is called then and only then. Nothing here imports
// DevTools at run time, only its types, so an app without it installs and loads nothing more.
// The panel is a json-render dock: described here, drawn by DevTools, no page of void-fbtee's own
// to build or serve. `ctx.createJsonRenderer` is Vite DevTools' (its `json-render` types). The props
// follow the installed components' own schemas (`@devframes/json-render`, 1.3.6), which DevTools
// checks: its docs still show older names (`Stack` `vertical`, `Text` `content`).
import { existsSync, statSync } from "node:fs";
import { relative, sep } from "node:path";
import type { DevToolsPluginOptions, ViteDevToolsNodeContext } from "@vitejs/devtools-kit";
import type { JsonRenderSpec } from "@vitejs/devtools/json-render";
import { catalogFile, collect, missing, type Project } from "./catalogs";
import { check, markdownPages } from "./check";
import { unreviewed } from "./translate";

/** What the panel shows and does, handed over by the plugin (plugin.ts). */
export interface DevtoolsSource {
  project(): Project;
  /** Who translates after a save, and why not when one doesn't: one line each. */
  translators(): { gemini: string; claude: string; now: string };
  /** The dev server's void-fbtee lines so far (the last ones). */
  lines(): ReadonlyArray<string>;
  prepare(): void;
  translate(): void;
  check(): void;
  /** Call `listener` whenever something the panel shows may have changed. */
  onChange(listener: () => void): void;
  /** Call `listener` with each line void-fbtee logs, as it's logged. */
  onLine(listener: (line: string) => void): void;
}

const ID = "void-fbtee";
const LINES_SHOWN = 40;

/** One language's row: its counts, from the catalog and what's still open in it. */
function languages(p: Project) {
  // The app's own strings: fbtee's built-in ones are counted apart (their own column).
  const { texts, builtinHashes } = collect(p);
  const total = Object.keys(texts).filter((hash) => !builtinHashes.has(hash)).length;
  const waiting = unreviewed(p);
  return missing(p).map((m) => {
    const file = catalogFile(p, m.locale);
    return {
      language: m.locale,
      translated: m.noCatalog ? 0 : Math.max(0, total - m.app.length),
      untranslated: m.noCatalog ? total : m.app.length,
      builtin: m.builtin,
      review: waiting.get(m.locale) ?? 0,
      catalog: existsSync(file) ? `${(statSync(file).size / 1024).toFixed(1)} KB` : "none yet",
    };
  });
}

/** The panel, from what the project is now. */
function spec(source: DevtoolsSource): JsonRenderSpec {
  const p = source.project();
  const problems = check(p);
  const rel = (f: string) => relative(p.root, f).split(sep).join("/");
  const pages = markdownPages(p).map((page) => ({
    page: rel(page.file),
    language: page.locale,
    state: page.state,
  }));
  const who = source.translators();
  const lines = source.lines().slice(-LINES_SHOWN);
  return {
    root: "root",
    elements: {
      root: {
        type: "Stack",
        props: { direction: "column", gap: 12, padding: 8 },
        children: ["header", "languages", "problems", "pages", "translators", "log"],
      },
      header: {
        type: "Stack",
        props: { direction: "row", gap: 8, align: "center" },
        children: ["title", "state", "prepare", "translate", "check"],
      },
      title: { type: "Text", props: { text: "void-fbtee", variant: "heading" } },
      state: {
        type: "Badge",
        props: problems.length
          ? { text: `${problems.length} would stop vp build`, variant: "warning" }
          : { text: "all translated", variant: "success" },
      },
      prepare: {
        type: "Button",
        props: { label: "Prepare", icon: "ph:list-plus-duotone", variant: "secondary" },
        on: { press: { action: `${ID}:prepare` } },
      },
      translate: {
        type: "Button",
        props: { label: "Translate now", icon: "ph:translate-duotone", variant: "primary" },
        on: { press: { action: `${ID}:translate` } },
      },
      check: {
        type: "Button",
        props: { label: "Check", icon: "ph:check-circle-duotone", variant: "secondary" },
        on: { press: { action: `${ID}:check` } },
      },
      languages: { type: "Card", props: { title: "Languages" }, children: ["languages-table"] },
      "languages-table": {
        type: "DataTable",
        props: {
          columns: [
            { key: "language", label: "Language" },
            { key: "translated", label: "Translated" },
            { key: "untranslated", label: "Untranslated" },
            { key: "builtin", label: "fbtee's own, untranslated" },
            { key: "review", label: "Waiting for review" },
            { key: "catalog", label: "Catalog" },
          ],
          rows: languages(p),
        },
      },
      problems: {
        type: "Card",
        props: { title: "What vp build stops on" },
        children: [problems.length ? "problems-list" : "problems-none"],
      },
      "problems-list": { type: "CodeBlock", props: { code: problems.join("\n"), height: 220 } },
      "problems-none": { type: "Text", props: { text: "Nothing: vp build passes." } },
      pages: {
        type: "Card",
        props: { title: "Translated pages" },
        children: [pages.length ? "pages-table" : "pages-none"],
      },
      "pages-table": {
        type: "DataTable",
        props: {
          columns: [
            { key: "page", label: "Page" },
            { key: "language", label: "Language" },
            { key: "state", label: "State" },
          ],
          rows: pages,
        },
      },
      "pages-none": { type: "Text", props: { text: "No markdown pages to translate." } },
      translators: {
        type: "Card",
        props: { title: "Translators (vp dev, after each save)" },
        children: ["translators-table"],
      },
      "translators-table": {
        type: "KeyValueTable",
        props: {
          data: {
            "Gemini (Void's AI)": who.gemini,
            "Claude Code": who.claude,
            Now: who.now,
          },
        },
      },
      log: {
        type: "Card",
        props: { title: "void-fbtee's log", collapsible: true },
        children: ["log-lines"],
      },
      "log-lines": {
        type: "CodeBlock",
        props: { code: lines.length ? lines.join("\n") : "(nothing yet)", height: 260 },
      },
    },
  };
}

/** The plugin's `devtools` hook (Vite DevTools Kit's `Plugin.devtools`). */
export function devtoolsHook(source: DevtoolsSource): DevToolsPluginOptions {
  return {
    setup(ctx: ViteDevToolsNodeContext) {
      // The dev server only: a build has no saves to translate, and nothing live to show.
      if (ctx.mode !== "dev") {
        return;
      }
      const ui = ctx.createJsonRenderer(spec(source));
      ctx.docks.register({
        id: ID,
        title: "void-fbtee",
        icon: "ph:translate-duotone",
        type: "json-render",
        view: ui.view,
      });

      // The buttons, and the same three in the command palette (Mod+K).
      const actions = [
        { name: `${ID}:prepare`, title: "void-fbtee: prepare the catalogs", run: source.prepare },
        { name: `${ID}:translate`, title: "void-fbtee: translate now", run: source.translate },
        { name: `${ID}:check`, title: "void-fbtee: check", run: source.check },
      ];
      for (const a of actions) {
        ctx.rpc.register({
          name: a.name,
          type: "action",
          setup: () => ({ handler: async () => a.run() }),
        });
        ctx.commands.register({
          id: a.name,
          title: a.title,
          icon: "ph:translate-duotone",
          category: "void-fbtee",
          handler: async () => a.run(),
        });
      }

      // Everything void-fbtee logs (what each translator does, Claude Code's tool use and answer
      // among it), as a terminal in DevTools as well as the dev server's own output.
      let terminal: ReadableStreamDefaultController<string> | undefined;
      ctx.terminals.register({
        id: `${ID}:log`,
        title: "void-fbtee",
        status: "running",
        stream: new ReadableStream<string>({
          start(controller) {
            terminal = controller;
            for (const line of source.lines()) {
              controller.enqueue(`${line}\n`);
            }
          },
        }),
      });
      source.onLine((line) => terminal?.enqueue(`${line}\n`));

      // The panel follows every change, and a message says when the build would stop (and when
      // it no longer would), once per change of count rather than per save.
      let shown: number | undefined;
      const message = `${ID}:build`;
      source.onChange(() => {
        ui.updateSpec(spec(source));
        const count = check(source.project()).length;
        if (count === shown) {
          return;
        }
        const first = shown === undefined;
        shown = count;
        void ctx.messages.remove(message).then(() =>
          ctx.messages.add({
            id: message,
            message: count
              ? `void-fbtee: ${count} would stop vp build`
              : "void-fbtee: nothing would stop vp build",
            description: count
              ? "See the void-fbtee panel: what's left, and who translates it."
              : undefined,
            level: count ? "warn" : "success",
            category: "i18n",
            notify: !first || count > 0,
          }),
        );
      });
    },
  };
}
