// The Vite plugin in memory, through Vite's own builder, as fbtee tests its plugin
// (nkzw-tech/fbtee, packages/vite-plugin-fbtee/test/e2e.mjs): its shape, its hook filters, and
// what it does per environment. One module is built for the browser, for a second browser
// environment named "browser", and for a server environment named "worker": the environment is
// told by Vite's own `consumer` flag, not its name. Seconds, no app.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createBuilder, type Plugin, type Rollup } from "vite";
import { voidMarkdown } from "@void/md/plugin";
import { voidReact } from "@void/react/plugin";
import { voidFbtee } from "../../src/plugin";

const fixture = join(import.meta.dirname, "fixture");
let root: string;
beforeAll(() => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(fixture, root, { recursive: true });
  writeFileSync(
    join(root, "src/probe.ts"),
    `import { Temporal } from "temporal-polyfill";\nimport config from "virtual:void-fbtee/config";\nexport const temporal = Temporal;\nexport const locales = config.locales.map((l) => l.locale);\n`,
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const options = { sourceLocale: "en-US", locales: ["en-US", "de-DE"], src: ["src/**/*.tsx"] };

describe("its shape", () => {
  const [core] = voidFbtee(options) as Plugin[];
  const filter = (hook: unknown) => (hook as { filter: { id: RegExp } }).filter.id;

  test("named, first in order, with an api for other plugins", () => {
    expect(core!.name).toBe("void-fbtee");
    expect(core!.enforce).toBe("pre");
    expect(core!.api).toMatchObject({ options });
  });

  test("resolveId and load run only for void-fbtee's ids", () => {
    const resolve = filter(core!.resolveId);
    for (const id of ["virtual:void-fbtee/config", "virtual:void-fbtee/catalog/de-DE"])
      expect(resolve.test(id), id).toBe(true);
    for (const id of ["fbtee/server", "temporal-polyfill"]) expect(resolve.test(id), id).toBe(true);
    for (const id of ["react", "./main.tsx", "temporal-polyfill/global", "fbtee"])
      expect(resolve.test(id), id).toBe(false);
    const load = filter(core!.load);
    expect(load.test("\0virtual:void-fbtee/config")).toBe(true);
    expect(load.test("\0void-fbtee:server-temporal")).toBe(true);
    expect(load.test("/app/src/main.tsx")).toBe(false);
  });
});

describe("the site option", () => {
  test("an https address of a host alone, or none", () => {
    expect(() => voidFbtee({ ...options, site: "https://example.com" })).not.toThrow();
    expect(() => voidFbtee(options)).not.toThrow();
    for (const site of [
      "http://example.com",
      "https://example.com/",
      "https://example.com/blog",
      "example.com",
      "https://example.com?x=1",
    ])
      expect(() => voidFbtee({ ...options, site }), site).toThrow(/https address of a host alone/);
  });
});

describe("per environment", () => {
  let client: string;
  let browser: string;
  let worker: string;
  beforeAll(async () => {
    const builder = await createBuilder({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: voidFbtee(options),
      environments: {
        client: { build: { write: false, rollupOptions: { input: "src/probe.ts" } } },
        browser: {
          consumer: "client",
          build: { write: false, rollupOptions: { input: "src/probe.ts" } },
        },
        worker: {
          consumer: "server",
          build: { write: false, ssr: true, rollupOptions: { input: "src/probe.ts" } },
        },
      },
    });
    const code = async (name: "client" | "browser" | "worker") => {
      const out = (await builder.build(builder.environments[name]!)) as Rollup.RollupOutput;
      return out.output.map((c) => ("code" in c ? c.code : "")).join("\n");
    };
    client = await code("client");
    browser = await code("browser");
    worker = await code("worker");
  });

  test("a server environment gets Cloudflare's own Temporal, not the polyfill", () => {
    expect(worker).toContain("no Temporal on the server");
    expect(worker).toContain("globalThis.Temporal");
  });

  test("the browser keeps the polyfill, whatever its environment is called", () => {
    for (const code of [client, browser]) expect(code).not.toContain("no Temporal on the server");
  });

  test("the virtual config carries the app's languages, in both", () => {
    // Minified in the browser (locale:`en-US`), as JSON on the server ("locale": "en-US").
    const locale = (tag: string) => `["\`]?locale["\`]?\\s*:\\s*["\`]${tag}["\`]`;
    const both = new RegExp(`${locale("en-US")}.*${locale("de-DE")}`, "s");
    for (const code of [client, worker]) expect(code).toMatch(both);
  });
});

// virtual:void-fbtee/md-pages: @void/md's own pages list when the app has @void/md's plugin (by its
// name, "void-md"), so the middleware can give a markdown page's frontmatter to link previews; an
// empty list without it, so the package needs no peer dependency on @void/md.
describe("markdown pages", () => {
  const build = async (plugins: Plugin[]) => {
    const dir = mkdtempSync(join(import.meta.dirname, ".tmp-"));
    cpSync(fixture, dir, { recursive: true });
    mkdirSync(join(dir, "pages/en-US"), { recursive: true });
    writeFileSync(join(dir, "pages/en-US/hello.md"), "---\ntitle: Hello page\n---\n\n# Hello\n");
    writeFileSync(
      join(dir, "src/md.ts"),
      `import pages from "virtual:void-fbtee/md-pages";\nexport const found = pages.map((p) => p.path + "|" + p.frontmatter.title);\n`,
    );
    try {
      const builder = await createBuilder({
        root: dir,
        configFile: false,
        logLevel: "silent",
        plugins,
        environments: {
          worker: {
            consumer: "server",
            build: { write: false, ssr: true, rollupOptions: { input: "src/md.ts" } },
          },
        },
      });
      const out = (await builder.build(builder.environments.worker!)) as Rollup.RollupOutput;
      return out.output.map((c) => ("code" in c ? c.code : "")).join("\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test("with @void/md: its pages, each with its frontmatter", async () => {
    // void-md needs a framework adapter beside it, as in an app (@void/react's).
    const code = await build([
      ...voidFbtee(options),
      ...[voidReact()].flat(),
      ...[voidMarkdown()].flat(),
    ] as Plugin[]);
    expect(code).toContain("/en-US/hello");
    expect(code).toContain("Hello page");
  });

  test("without it: none", async () => {
    const code = await build(voidFbtee(options) as Plugin[]);
    expect(code).not.toContain("/en-US/hello");
    expect(code).not.toContain("@void/md");
  });
});
