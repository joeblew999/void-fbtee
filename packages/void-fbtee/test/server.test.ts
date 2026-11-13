// inLocale() from void-fbtee/server, as an app's server code runs it with no request (a scheduled
// job, a queue consumer), routeUrl() from void-fbtee/routes and Zod's messages in its language: built through the plugin for a server environment, as Void builds a
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
  link: () => Promise<string>;
  linkWithParams: () => Promise<string>;
  linkElsewhere: () => Promise<string>;
  linkOutside: () => string;
  linkPlain: () => string;
  zodMessages: () => Promise<string[]>;
  zodOwn: () => Promise<string>;
  zodOutside: () => string;
};

beforeAll(async () => {
  root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(join(import.meta.dirname, "fixture"), root, { recursive: true });
  const server = join(import.meta.dirname, "../src/server.ts");
  const routes = join(import.meta.dirname, "../src/routes.ts");
  writeFileSync(
    join(root, "src/job.ts"),
    `import { fbs } from "fbtee";
import { inLocale } from ${JSON.stringify(server)};
import { routeUrl } from ${JSON.stringify(routes)};
const hello = () => String(fbs("Hello", "Greeting in the test fixture"));
export const german = () => inLocale("de-DE", hello);
export const afterAwait = () =>
  inLocale("de-DE", async () => { await new Promise((r) => setTimeout(r, 10)); return hello(); });
export const nested = () =>
  inLocale("en-US", async () => [hello(), await inLocale("de-DE", hello), hello()]);
export const dir = () => inLocale("ar-EG", ({ dir }) => dir);
export const unknown = () => inLocale("xx-XX", hello).then(() => "ran", (e) => String(e.message));
export const link = () => inLocale("de-DE", () => routeUrl("/[lang]/events" as never));
export const linkWithParams = () =>
  inLocale("de-DE", () => routeUrl("/[lang]/events/[id]" as never, { params: { id: 7 } } as never));
export const linkElsewhere = () =>
  inLocale("de-DE", () => routeUrl("/[lang]/events" as never, { params: { lang: "ar-EG" } } as never));
export const linkOutside = () => { try { return routeUrl("/[lang]/events" as never); } catch (e) { return String(e.message); } };
export const linkPlain = () => routeUrl("/api/live" as never);
// Zod's messages in the current language, set up as the middleware does it.
import { z } from "zod";
import { setup } from "virtual:void-fbtee/zod";
import { currentLocale } from ${JSON.stringify(server)};
setup(currentLocale);
const tooShort = () => z.string().min(1).safeParse("").error?.issues[0]?.message;
const own = () => z.string().min(1, "Give it a name").safeParse("").error?.issues[0]?.message;
export const zodMessages = () =>
  Promise.all(["en-US", "de-DE", "ar-EG"].map((l) => inLocale(l, tooShort)));
export const zodOwn = () => inLocale("de-DE", own);
export const zodOutside = () => tooShort();
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
        // cloudflare:workers is Cloudflare's own module: Void's revalidate (void/isr) imports it only
        // when running there, so it stays outside the bundle.
        build: {
          ssr: true,
          outDir: "dist",
          rollupOptions: { input: "src/job.ts", external: ["cloudflare:workers"] },
        },
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

test("routeUrl: the current language, with no lang given", async () => {
  expect(await probe.link()).toBe("/de-DE/events");
  expect(await probe.linkWithParams()).toBe("/de-DE/events/7");
});

test("routeUrl: params.lang still picks another language", async () => {
  expect(await probe.linkElsewhere()).toBe("/ar-EG/events");
});

test("routeUrl: with no current language, an error that says to pass lang", () => {
  expect(probe.linkOutside()).toMatch(
    /routeUrl\("\/\[lang\]\/events"\): no current language here.*pass params\.lang/,
  );
});

test("routeUrl: an address with no [lang] is Void's own", () => {
  expect(probe.linkPlain()).toBe("/api/live");
});

test("Zod's own messages in the current language", async () => {
  const [en, de, ar] = await probe.zodMessages();
  expect(en).toBe("Too small: expected string to have >=1 characters");
  expect(de).not.toBe(en);
  expect(de).toMatch(/Zeichen/);
  expect(ar).toMatch(/[\u0600-\u06FF]/);
});

test("an app's own message still wins", async () => {
  expect(await probe.zodOwn()).toBe("Give it a name");
});

test("with no current language, Zod's English", () => {
  expect(probe.zodOutside()).toBe("Too small: expected string to have >=1 characters");
});
