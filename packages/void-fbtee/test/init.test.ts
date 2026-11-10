// `void-fbtee init`, on copies of what `void init` made (e2e/fresh/<toolchain>/, also what the
// fresh-install e2e tests start from).
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

const generated = (toolchain: string) => join(import.meta.dirname, "../../../e2e/fresh", toolchain);
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function app(toolchain: "vite-plus" | "vite") {
  const root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  dirs.push(root);
  cpSync(generated(toolchain), root, { recursive: true });
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
  expect(first.done.length).toBe(10);

  const vite = read(root, "vite.config.ts");
  expect(vite).toContain(`import { defineConfig } from "vite-plus";`);
  expect(vite).toContain(`import voidFbtee from "void-fbtee/vite";`);
  // First in plugins, before voidPlugin().
  expect(vite.indexOf("voidFbtee({")).toBeLessThan(vite.indexOf("voidPlugin()"));
  expect(vite).toMatch(/jsPlugins: \["@nkzw\/eslint-plugin-fbtee", "void-fbtee\/lint"\]/);
  expect(vite).toContain(`"void-fbtee/no-show-count-no": "error"`);
  expect(vite.endsWith(");\n")).toBe(true);

  expect(read(root, "void.config.ts")).toMatch(/compatibility_flags: \["temporal"\]/);
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
  expect(pkg.dependencies["void-fbtee"]).toBe(own.version);
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
  mkdirSync(join(root, "pages"));
  writeFileSync(join(root, "pages/layout.tsx"), layout);
  const { todo } = await init(options(root));
  expect(read(root, "pages/layout.tsx")).toBe(layout);
  expect(todo.join("\n")).toContain(
    "pages/layout.tsx: wrap the layout's children in <I18nProvider>",
  );
});

test("in a workspace, the lint settings are left for the root config", async () => {
  // Without its own pnpm-workspace.yaml, the app is part of this repo's workspace.
  const root = app("vite-plus");
  rmSync(join(root, "pnpm-workspace.yaml"));
  const { todo } = await init(options(root));
  const vite = read(root, "vite.config.ts");
  expect(vite).toContain(`import { defineConfig } from "vite";`);
  expect(vite).not.toContain("lint");
  expect(todo.join("\n")).toMatch(
    /vite\.config\.ts: Vite\+ only reads lint settings from the workspace's root config/,
  );
});
