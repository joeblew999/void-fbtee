// inLocale() from void-fbtee/server, as an app's server code runs it with no request (a scheduled
// job, a queue consumer): built through the plugin for a server environment, as Void builds a
// Worker, then run. The fixture's catalog has German for its strings (test/fixture/i18n/).
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createBuilder, type Plugin } from "vite";
import { voidFbtee } from "../src/plugin";

let root: string;
let probe: {
  german: () => Promise<string>;
  afterAwait: () => Promise<string>;
  nested: () => Promise<string[]>;
  dir: () => Promise<string>;
  unknown: () => Promise<string>;
};

beforeAll(async () => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(join(import.meta.dirname, "fixture"), root, { recursive: true });
  const server = join(import.meta.dirname, "../src/server.ts");
  writeFileSync(
    join(root, "src/job.ts"),
    `import { fbs } from "fbtee";
import { inLocale } from ${JSON.stringify(server)};
const hello = () => String(fbs("Hello", "Greeting in the test fixture"));
export const german = () => inLocale("de-DE", hello);
export const afterAwait = () =>
  inLocale("de-DE", async () => { await new Promise((r) => setTimeout(r, 10)); return hello(); });
export const nested = () =>
  inLocale("en-US", async () => [hello(), await inLocale("de-DE", hello), hello()]);
export const dir = () => inLocale("ar-EG", ({ dir }) => dir);
export const unknown = () => inLocale("xx-XX", hello).then(() => "ran", (e) => String(e.message));
`,
  );
  const builder = await createBuilder({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: voidFbtee({
      sourceLocale: "en-US",
      locales: ["en-US", "de-DE", "ar-EG"],
      src: ["src/**/*.tsx"],
    }) as Plugin[],
    environments: {
      worker: {
        consumer: "server",
        // Everything in the bundle, as in a Worker: left outside, `fbtee` and the bundled
        // `fbtee/server` would each have their own copy of fbtee's core.
        resolve: { noExternal: true },
        build: { ssr: true, outDir: "dist", rollupOptions: { input: "src/job.ts" } },
      },
    },
  });
  await builder.build(builder.environments.worker!);
  probe = await import(pathToFileURL(join(root, "dist/job.js")).href);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("translates with no request around it", async () => {
  expect(await probe.german()).toBe("Hallo");
});

test("stays in its language after an await", async () => {
  expect(await probe.afterAwait()).toBe("Hallo");
});

test("one language inside another, and back", async () => {
  expect(await probe.nested()).toEqual(["Hello", "Hallo", "Hello"]);
});

test("gives the language's text direction", async () => {
  expect(await probe.dir()).toBe("rtl");
});

test("a language the app hasn't is an error", async () => {
  expect(await probe.unknown()).toMatch(/inLocale\("xx-XX"\): not one of the app's languages/);
});
