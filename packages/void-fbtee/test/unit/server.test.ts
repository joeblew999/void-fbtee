// inLocale() from void-fbtee/server, as an app's server code runs it with no request (a scheduled
// job, a queue consumer), routeUrl() from void-fbtee/routes and Zod's messages in its language: built through the plugin for a server environment, as Void builds a
// Worker, then run. The fixture's catalog has German for its strings (test/unit/fixture/i18n/).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { copyFixture } from "./copy-fixture";
import { createBuilder, type Plugin } from "vite";
import { langAttrs } from "../../src/locales";
import { voidFbtee } from "../../src/plugin";

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
  map: () => Promise<string>;
  texts: () => { de: string[]; ar: string; deFallsBack: string; none: null };
};

beforeAll(async () => {
  root = copyFixture();
  // Void's generated list of the app's pages, as \`void prepare\` writes it (PagePathMap).
  mkdirSync(join(root, ".void"), { recursive: true });
  writeFileSync(
    join(root, ".void/routes.d.ts"),
    `declare module "void/routes" {
  export interface PagePathMap {
    "/[lang]": "lang";
    /** @deprecated Use "/[lang]" instead. */
    "/:lang": PagePathMap["/[lang]"];
    "/[lang]/events": "lang";
    "/[lang]/events/new": "lang";
    "/[lang]/events/[id]": "lang" | "id";
    "/about": never;
  }
}
`,
  );
  const server = join(import.meta.dirname, "../../src/server.ts");
  const routes = join(import.meta.dirname, "../../src/routes.ts");
  writeFileSync(
    join(root, "src/job.ts"),
    `import { fbs } from "fbtee";
import { inLocale } from ${JSON.stringify(server)};
import { routeUrl } from ${JSON.stringify(routes)};
const hello = () => fbs("Hello", "Greeting in the test fixture");
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
import { sitemap } from ${JSON.stringify(server)};
const c = { req: { url: "https://example.com/sitemap.xml" } };
import { pickText, textLocales } from ${JSON.stringify(server)};
const rows = [{ locale: "en-US", title: "Night market" }, { locale: "ar-EG", title: "السوق الليلي" }];
export const texts = () => ({
  de: textLocales("de-DE"),
  ar: pickText(rows, "ar-EG")?.title,
  deFallsBack: pickText(rows, "de-DE")?.title,
  none: pickText([{ locale: "ar-EG" }], "de-DE") ?? null,
});
export const map = () =>
  sitemap(c, {
    pages: [
      { path: "/[lang]/events", lastmod: "2026-11-12T09:00:00Z" },
      { path: "/[lang]/events/[id]", params: { id: "a&b" }, lastmod: (l) => (l === "de-DE" ? "2026-11-10" : undefined) },
    ],
    exclude: ["/[lang]/events/new"],
  }).text();
`,
  );
  const builder = await createBuilder({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: voidFbtee({
      sourceLocale: "en-US",
      locales: ["en-US", "de-DE", "ar-EG"],
      // German falls back to English, for textLocales and pickText.
      fallbackLocales: { "de-DE": ["en-US"] },
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

describe("sitemap()", () => {
  const urls = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  test("every page under [lang] with no other param, in every language, plus the app's own", async () => {
    expect(urls(await probe.map())).toEqual([
      "https://example.com/en-US",
      "https://example.com/de-DE",
      "https://example.com/ar-EG",
      "https://example.com/en-US/events",
      "https://example.com/de-DE/events",
      "https://example.com/ar-EG/events",
      // The id as Void's routeUrl encodes it.
      "https://example.com/en-US/events/a%26b",
      "https://example.com/de-DE/events/a%26b",
      "https://example.com/ar-EG/events/a%26b",
    ]);
  });

  test("each lists all its languages and x-default: / for the home page, else the fallback's", async () => {
    const urls = (await probe.map()).split("</url>");
    const links = (url: string) =>
      [...url.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`);
    // The home page: "/" sends each visitor to their own language.
    expect(links(urls[0]!)).toEqual([
      "en-US https://example.com/en-US",
      "de-DE https://example.com/de-DE",
      "ar-EG https://example.com/ar-EG",
      "x-default https://example.com/",
    ]);
    // Any other page: its page in the fallback language (the source, as none is set).
    const events = urls.find((u) => u.includes("<loc>https://example.com/en-US/events</loc>"))!;
    expect(links(events).at(-1)).toBe("x-default https://example.com/en-US/events");
  });

  test("lastmod only where given, for every language or one", async () => {
    const xml = await probe.map();
    const lastmods = [...xml.matchAll(/<loc>(.*?)<\/loc>\s*(?:<lastmod>(.*?)<\/lastmod>)?/g)].map(
      (m) => `${m[1]!.replace("https://example.com", "")} ${m[2] ?? "-"}`,
    );
    expect(lastmods).toContain("/en-US -");
    expect(lastmods).toContain("/de-DE/events 2026-11-12T09:00:00Z");
    expect(lastmods).toContain("/de-DE/events/a%26b 2026-11-10");
    expect(lastmods).toContain("/en-US/events/a%26b -");
  });
});

describe("what people post, in their own language", () => {
  test("textLocales: the page's language, then its fallbacks", () => {
    expect(probe.texts().de).toEqual(["de-DE", "en-US"]);
  });

  test("pickText: the page's own, else a fallback's, else none (the original)", () => {
    const { ar, deFallsBack, none } = probe.texts();
    expect(ar).toBe("السوق الليلي");
    expect(deFallsBack).toBe("Night market");
    expect(none).toBeNull();
  });

  test("langAttrs: its language, and its direction", () => {
    expect(langAttrs("ar-EG")).toEqual({ lang: "ar-EG", dir: "rtl" });
    expect(langAttrs("th-TH")).toEqual({ lang: "th-TH", dir: "ltr" });
  });
});
