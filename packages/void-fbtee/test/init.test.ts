// `void-fbtee init`, on copies of apps `void init` made for this run (test/void-init.ts), the
// files only: no node_modules.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { init } from "../src/init";
import { VOID_INIT_DIR } from "./void-init";

const generated = (toolchain: string) => join(VOID_INIT_DIR, toolchain);
// What `void init` installs or generates, rather than writes as the app's files.
const NOT_COPIED = new Set(["node_modules", ".void", "pnpm-lock.yaml", ".git"]);
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function app(toolchain: "vite-plus" | "vite") {
  const root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  dirs.push(root);
  cpSync(generated(toolchain), root, {
    recursive: true,
    filter: (src) => !NOT_COPIED.has(src.split("/").pop() ?? ""),
  });
  return root;
}
const read = (root: string, f: string) => readFileSync(join(root, f), "utf8");
const options = (root: string) => ({ root, sourceLocale: "en-US", locales: ["en-US", "de-DE"] });

/** Every file under root with its text, to show a second run changes nothing. */
function snapshot(root: string, dir = root): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory())
      Object.assign(out, snapshot(root, path), { [relative(root, path) + "/"]: "" });
    else out[relative(root, path)] = readFileSync(path, "utf8");
  }
  return out;
}

test("wires void-fbtee into a Vite+ app, and a second run changes nothing", async () => {
  const root = app("vite-plus");
  const first = await init(options(root));
  expect(first.done.length).toBe(13);

  const vite = read(root, "vite.config.ts");
  expect(vite).toContain(`import { defineConfig } from "vite-plus";`);
  expect(vite).toContain(`import { voidFbtee } from "void-fbtee/plugin";`);
  // The languages once, in src/locales.ts, registered for void-fbtee's types; vite.config.ts uses them.
  const locales = read(root, "src/locales.ts");
  expect(locales).toContain(`export const locales = ["en-US", "de-DE"] as const;`);
  expect(locales).toContain("interface VoidFbteeRegister");
  expect(vite).toMatch(
    /import \{ (locales, sourceLocale|sourceLocale, locales) \} from "\.\/src\/locales\.ts";/,
  );
  expect(vite).toContain("voidFbtee({");
  expect(vite).toMatch(/voidFbtee\(\{\s*sourceLocale(: sourceLocale)?,\s*locales(: locales)?/);
  // First in plugins, before voidPlugin().
  expect(vite.indexOf("voidFbtee({")).toBeLessThan(vite.indexOf("voidPlugin()"));
  expect(vite).toMatch(/jsPlugins: \["@nkzw\/eslint-plugin-fbtee", "void-fbtee\/lint"\]/);
  expect(vite).toContain(`"void-fbtee/no-show-count-no": "error"`);
  expect(vite.endsWith(");\n")).toBe(true);

  expect(read(root, "void.config.ts")).toMatch(/compatibility_flags: \["temporal"\]/);
  expect(read(root, "void.config.ts")).toMatch(/"\/": \{\s*to: "\/en-US",\s*status: 301,?\s*\}/);
  expect(read(root, "middleware/99.i18n.ts")).toContain(`from "void-fbtee/middleware"`);
  expect(read(root, "pages/layout.tsx")).toContain("<I18nProvider>{children}</I18nProvider>");
  expect(existsSync(join(root, "i18n/translations"))).toBe(true);

  const tsconfig = JSON.parse(read(root, "tsconfig.json"));
  expect(tsconfig.compilerOptions.types).toContain("fbtee/ReactTypes");
  expect(tsconfig.compilerOptions.lib).toEqual(
    expect.arrayContaining(["ES2025", "DOM", "DOM.Iterable"]),
  );

  const pkg = JSON.parse(read(root, "package.json"));
  const own = JSON.parse(read(join(import.meta.dirname, ".."), "package.json"));
  // void-fbtee itself is the app's own choice of source (installed before init runs).
  expect(pkg.dependencies["void-fbtee"]).toBeUndefined();
  expect(pkg.dependencies.fbtee).toBe(own.devDependencies.fbtee);
  expect(pkg.devDependencies["@nkzw/eslint-plugin-fbtee"]).toBe(
    own.devDependencies["@nkzw/eslint-plugin-fbtee"],
  );
  expect(pkg.scripts["i18n:translate"]).toBe("void-fbtee translate");

  const agents = read(root, "AGENTS.md");
  expect(agents).toContain("node_modules/void-fbtee/skills/void-fbtee/SKILL.md");
  // Void's own block is kept.
  expect(agents).toContain(read(generated("vite-plus"), "AGENTS.md").trimEnd());

  const before = snapshot(root);
  const second = await init(options(root));
  expect(second.done).toEqual([]);
  expect(snapshot(root)).toEqual(before);
});

test("on plain Vite, it leaves defineConfig from vite and adds no lint settings", async () => {
  const root = app("vite");
  await init(options(root));
  const vite = read(root, "vite.config.ts");
  expect(vite).toContain(`import { defineConfig } from "vite";`);
  expect(vite).toContain("voidFbtee({");
  expect(vite).not.toContain("lint");
  expect(
    JSON.parse(read(root, "package.json")).devDependencies["@nkzw/eslint-plugin-fbtee"],
  ).toBeUndefined();
});

test("an existing layout is left alone, with the line to add", async () => {
  const root = app("vite-plus");
  const layout = `export default function Layout({ children }) {\n  return <main>{children}</main>;\n}\n`;
  mkdirSync(join(root, "pages"), { recursive: true });
  writeFileSync(join(root, "pages/layout.tsx"), layout);
  const { todo } = await init(options(root));
  expect(read(root, "pages/layout.tsx")).toBe(layout);
  expect(todo.join("\n")).toContain(
    "pages/layout.tsx: wrap the layout's children in <I18nProvider>",
  );
});

const withHome = (root: string) => {
  mkdirSync(join(root, "pages/[lang]"), { recursive: true });
  writeFileSync(join(root, "pages/[lang]/index.tsx"), "export default () => null;\n");
};

test("with a home page under pages/[lang]/: Void's not-found and error pages, translated", async () => {
  const root = app("vite-plus");
  withHome(root);
  const { done } = await init(options(root));
  expect(done).toContain(
    "pages/_not-found.tsx: created, Void's not-found page in the page's language",
  );
  expect(done).toContain("pages/_error.tsx: created, Void's error page in the page's language");
  const notFound = read(root, "pages/_not-found.tsx");
  expect(notFound).toContain(
    `fbt desc="Heading of the page shown for an address with nothing at it"`,
  );
  expect(notFound).toContain("<title>");
  expect(notFound).toContain(`routeUrl("/[lang]")`);
  expect(read(root, "pages/_error.tsx")).toContain("router.refresh()");
  const before = snapshot(root);
  await init(options(root));
  expect(snapshot(root)).toEqual(before);
});

test("a sitemap route, unless the app has its own", async () => {
  const root = app("vite-plus");
  await init(options(root));
  expect(read(root, "routes/sitemap.xml.ts")).toContain("sitemap(c)");
  const own = app("vite-plus");
  mkdirSync(join(own, "routes"), { recursive: true });
  writeFileSync(join(own, "routes/sitemap.xml.js"), "export const GET = () => null;\n");
  await init(options(own));
  expect(existsSync(join(own, "routes/sitemap.xml.ts"))).toBe(false);
});

test("an app's own not-found page is left alone", async () => {
  const root = app("vite-plus");
  withHome(root);
  const own = "export default () => <p>Gone</p>;\n";
  writeFileSync(join(root, "pages/_not-found.jsx"), own);
  await init(options(root));
  expect(read(root, "pages/_not-found.jsx")).toBe(own);
  expect(existsSync(join(root, "pages/_not-found.tsx"))).toBe(false);
  expect(existsSync(join(root, "pages/_error.tsx"))).toBe(true);
});

test("with no home under pages/[lang]/, neither page, and the line to come back", async () => {
  const root = app("vite-plus");
  const { todo } = await init(options(root));
  expect(existsSync(join(root, "pages/_not-found.tsx"))).toBe(false);
  expect(existsSync(join(root, "pages/_error.tsx"))).toBe(false);
  expect(todo.join("\n")).toContain("once the app has a home page under pages/[lang]/");
});

/** A pnpm workspace with a Vite+ app in apps/app; the root config has `rootConfig`. */
function workspace(rootConfig: string, rootDevDependencies: Record<string, string> = {}) {
  const ws = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  dirs.push(ws);
  writeFileSync(join(ws, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  writeFileSync(join(ws, "package.json"), JSON.stringify({ devDependencies: rootDevDependencies }));
  writeFileSync(join(ws, "vite.config.ts"), rootConfig);
  const root = join(ws, "apps/app");
  mkdirSync(root, { recursive: true });
  cpSync(app("vite-plus"), root, { recursive: true });
  // Without its own pnpm-workspace.yaml, the app is part of the workspace.
  rmSync(join(root, "pnpm-workspace.yaml"));
  return { ws, root };
}

test("in a workspace, the lint settings and plugin are left for the root", async () => {
  const { root } = workspace(`export default {};\n`);
  const { todo } = await init(options(root));
  const vite = read(root, "vite.config.ts");
  expect(vite).toContain(`import { defineConfig } from "vite";`);
  expect(vite).not.toContain("lint");
  expect(JSON.parse(read(root, "package.json")).devDependencies).not.toHaveProperty(
    "@nkzw/eslint-plugin-fbtee",
  );
  expect(todo.join("\n")).toMatch(
    /vite\.config\.ts: Vite\+ only reads lint settings from the workspace's root config/,
  );
  expect(todo.join("\n")).toMatch(/package\.json: add "@nkzw\/eslint-plugin-fbtee"/);
  expect(todo[0]).toMatch(/^vp /);
});

test("in a workspace whose root already has them, there's nothing to add", async () => {
  const { root } = workspace(`export default { lint: { jsPlugins: ["void-fbtee/lint"] } };\n`, {
    "@nkzw/eslint-plugin-fbtee": "5.0.0",
  });
  const { todo } = await init(options(root));
  expect(todo.join("\n")).not.toMatch(/lint settings|eslint-plugin-fbtee/);
});
