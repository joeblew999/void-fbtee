// The fresh-app tests' shared steps (the `fresh` project, `vp run test:fresh`): void-fbtee as a
// developer receives it, in fresh `void init` apps, the way voidzero-dev/void tests its own packages
// before publishing (.github/workflows/prepublish-test.yml, .github/scripts/packed-consumer.mjs, at
// ee4eaa7): the package packed as npm would publish it (setup.ts), the tarball checked as Void checks
// its own (tarball.test.ts), then installed into a new app with npm and with pnpm, on plain Vite and
// on Vite+, with a clean environment and strict settings. No local registry: Void needs one for
// packages that depend on each other by version; this is one package, so the tarball file is
// installed, as an app installs it from npm. Work happens in .vitest/ (git ignores it).
//
// One test file per app (vite-plus-pnpm.test.ts, …), each a list of steps run in order: a step
// whose earlier step failed is skipped, so the first failure is the one reported.
//
// Each app also gets Void's own docs examples (e2e/fresh/app/), each checked in a language other
// than the source: what works, and, as known gaps, what doesn't yet (plans/quiet-harbor-atlas.md).
//
// Each app is made by `void init`, the Void version this repo pins (apps/example's), in an empty
// folder. `void init` picks the package manager from the folder (packages/void/src/cli/init.ts):
// on Vite+ pnpm unless package.json says npm (`packageManager`); on plain Vite npm unless there's a
// pnpm-workspace.yaml.
//
// There's no lockfile in a new app, so each install takes the newest fbtee 6.x that void-fbtee's
// range allows (init writes `^` plus the tested version): the weekly run shows a new fbtee release
// breaking void-fbtee before a developer finds it.
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseAst } from "vite";
import { describe, expect, inject, test } from "vite-plus/test";
import { readCatalog } from "../../packages/void-fbtee/src/dev/catalog-file";
import {
  field,
  isRecord,
  parseJson,
  textField,
  textRecord,
} from "../../packages/void-fbtee/src/guards";
import { got } from "../got";
import { TRANSLATED } from "../locales";
import "../provided";

/** A JSON file holding an object (a package.json), to read and change. */
function readObject(file: string): Record<string, unknown> {
  const value = parseJson(readFileSync(file, "utf8"));
  if (!isRecord(value)) {
    throw new Error(`${file} isn't a JSON object`);
  }
  return value;
}

const root = resolve(import.meta.dirname, "../..");
const work = join(root, ".vitest");

type Pm = "npm" | "pnpm";
type App = {
  pm: Pm;
  toolchain: "vite" | "vite-plus";
  port: number;
  /** The language the app's code is written in, when not English (`init --source-locale`). */
  written?: "th-TH";
  /** A developer's first app on a machine with neither translator: no Claude Code, no Void AI. */
  noTranslator?: true;
};
export const APPS = {
  "vite-plus-pnpm": { pm: "pnpm", toolchain: "vite-plus", port: 5274 },
  "vite-plus-npm": { pm: "npm", toolchain: "vite-plus", port: 5276 },
  "vite-pnpm": { pm: "pnpm", toolchain: "vite", port: 5275 },
  "vite-npm": { pm: "npm", toolchain: "vite", port: 5277 },
  "thai-source": {
    pm: "pnpm",
    toolchain: "vite-plus",
    port: 5279,
    written: "th-TH",
  },
  "no-translator": {
    pm: "pnpm",
    toolchain: "vite-plus",
    port: 5280,
    noTranslator: true,
  },
} satisfies Record<string, App>;
export type AppName = keyof typeof APPS;

// The Thai-source app's translations, as the agent `vp dev` hands them to writes them: by
// source text, one line per plural form each language uses (fbtee's codes: 16 zero, 8 two, 20 few,
// 12 many, 24 other), with exactly 1 its own entry. English then has one line, "other".
const FROM_THAI: Record<string, Record<string, string | Record<number, string>>> = {
  "en-US": {
    งานของชุมชน: "Community events",
    "เหลือ {number} ที่นั่ง": "{number} seats left",
    "เหลือ 1 ที่นั่ง": "1 seat left",
    ไม่มีอะไรอยู่ที่นี่: "There's nothing here",
    หน้าแรก: "Home",
    เกิดข้อผิดพลาด: "Something went wrong",
    "ตอนนี้สร้างหน้านี้ไม่ได้ ลองอีกครั้ง หรือเริ่มจากหน้าแรก":
      "This page couldn't be made just now. Try again, or start from the home page.",
    ลองอีกครั้ง: "Try again",
  },
  "ar-EG": {
    งานของชุมชน: "فعاليات المجتمع",
    "เหลือ {number} ที่นั่ง": {
      16: "لم يتبقَّ أي مقعد",
      8: "تبقّى مقعدان",
      20: "تبقّت {number} مقاعد",
      12: "تبقّى {number} مقعدًا",
      24: "تبقّى {number} مقعد",
    },
    "เหลือ 1 ที่นั่ง": "تبقّى مقعد واحد",
    ไม่มีอะไรอยู่ที่นี่: "لا يوجد شيء هنا",
    หน้าแรก: "الرئيسية",
    เกิดข้อผิดพลาด: "حدث خطأ",
    "ตอนนี้สร้างหน้านี้ไม่ได้ ลองอีกครั้ง หรือเริ่มจากหน้าแรก":
      "تعذّر إنشاء هذه الصفحة الآن. حاول مرة أخرى، أو ابدأ من الصفحة الرئيسية.",
    ลองอีกครั้ง: "حاول مرة أخرى",
    // fbtee's built-in list joiners, English in every app, as the example's ar-EG catalog has them.
    "{list of items}, and {last item}": "{list of items} و{last item}",
    "{list of items} and {last item}": "{list of items} و{last item}",
    "{list of items}, or {last item}": "{list of items} أو {last item}",
    "{list of items} or {last item}": "{list of items} أو {last item}",
  },
};

// The builds `void init` allows on Vite+ (its pnpm-workspace.yaml), for the plain-Vite pnpm app too.
const VOID_INIT_BUILDS = { "better-sqlite3": false, esbuild: true, sharp: true, workerd: true };
const VOID = join(root, "apps/example/node_modules/.bin/void");
const VOID_INIT = ["init", "--framework", "react", "--starter", "static", "--deploy", "none"];

// A clean environment, as Void's: no tokens, logins or tool settings of this machine's, and none
// of the package manager's own variables from the `vp run` this runs under (a developer types
// init in a terminal). Claude Code reads its sign-in from an empty folder: no machine-wide claude
// sign-in reaches an app, so the apps show what a machine without Claude Code gets.
const noClaude = join(work, "fresh-no-claude");
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CI: "true",
  CLAUDE_CONFIG_DIR: noClaude,
};
for (const key of Object.keys(env)) {
  if (/^(VOID_|VP_|CLOUDFLARE_|CF_|WRANGLER_|NPM_TOKEN$|NODE_AUTH_TOKEN$|npm_)/i.test(key)) {
    delete env[key];
  }
}

const run = (
  cmd: string,
  args: Array<string>,
  cwd: string,
  options: { capture?: boolean } = {},
) => {
  console.error(`\n$ (${cwd.replace(root, ".")}) ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd,
    env,
    stdio: ["ignore", options.capture ? "pipe" : 2, 2],
    encoding: "utf8",
  });
};
/** A command expected to fail: its output, or "" if it didn't fail. */
const failing = (cmd: string, args: Array<string>, cwd: string) => {
  try {
    execFileSync(cmd, args, { cwd, env, encoding: "utf8", stdio: "pipe" });
    return "";
  } catch (error) {
    return `${textField(error, "stdout") ?? ""}${textField(error, "stderr") ?? ""}` || "failed";
  }
};
const check = (ok: unknown, what: string) => {
  expect(Boolean(ok), what).toBe(true);
};
/**
 * Something that doesn't work yet in a fresh app: a gap in plans/quiet-harbor-atlas.md, at the
 * step that fixes it. It must still fail; once it works, this fails, so the step that fixed it
 * turns it into a check().
 */
const gap = (ok: unknown, what: string, step: number) => {
  expect(Boolean(ok), `works now, make it a check(): ${what}`).toBe(false);
  console.error(`✗ known gap (plans/quiet-harbor-atlas.md, step ${step}): ${what}`);
};
const exec = (pm: Pm, ...args: Array<string>): [Pm, Array<string>] => [pm, ["exec", "--", ...args]];
// These installs follow edits to package.json, as on a developer's machine; under CI (set, as in
// GitHub Actions) pnpm would otherwise refuse to update the lockfile.
const install = (pm: Pm): [Pm, Array<string>] => [
  pm,
  pm === "pnpm" ? ["install", "--no-frozen-lockfile"] : ["install"],
];

/**
 * Steps run in order: each a test, skipped once an earlier one has failed, so the report shows
 * the first failure and not the ones it caused.
 */
function steps() {
  let failed = "";
  return (what: string, fn: () => unknown) =>
    test(what, async (ctx) => {
      if (failed) {
        ctx.skip(`an earlier step failed: ${failed}`);
      }
      try {
        await fn();
      } catch (error) {
        failed = what;
        throw error;
      }
    });
}

/** One app's steps, from `void init` to its dev server. */
export function freshApp(target: AppName) {
  const app: App = APPS[target];
  const skip = inject("freshSkip") ?? "";
  describe.skipIf(Boolean(skip))(`${target}${skip ? ` (${skip})` : ""}`, () => {
    const step = steps();
    const dir = join(work, `fresh-${target}`);
    let installed = "";

    step(`void init makes a ${app.pm} app on ${app.toolchain}`, () => {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      mkdirSync(noClaude, { recursive: true });
      // Its own git repo, as a real app is: tools that honour .gitignore (Oxlint) would otherwise
      // skip it, since this repo ignores .vitest/.
      run("git", ["init", "--quiet"], dir);
      if (app.toolchain === "vite" && app.pm === "pnpm") {
        allowBuild(dir);
      }
      if (app.toolchain === "vite-plus" && app.pm === "npm") {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({ name: target, private: true, packageManager: `npm@${npmVersion()}` }) +
            "\n",
        );
      }
      run(VOID, [...VOID_INIT, "--toolchain", app.toolchain], dir);
      check(
        existsSync(join(dir, app.pm === "npm" ? "package-lock.json" : "pnpm-lock.yaml")),
        `void init made a ${app.pm} app`,
      );
      strict(dir, app.pm);
      pinUpstream(dir, app.pm);
    });

    step("void-fbtee installs, and its command runs", () => {
      const pkg = readObject(join(dir, "package.json"));
      pkg.dependencies = {
        ...textRecord(pkg.dependencies),
        "void-fbtee": `file:${got(inject("freshTarball"), "the packed tarball")}`,
      };
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
      run(...install(app.pm), dir);
      // Formatted as a Vite+ developer would first (void init's own output isn't, under Vite+ 1.6:
      // package.json, pages/style.css, tsconfig.json, vite.config.ts, void.config.ts), so anything
      // unformatted after void-fbtee init is void-fbtee's.
      if (app.toolchain === "vite-plus") {
        run(...exec(app.pm, "vp", "fmt"), dir);
      }
      installed = realpathSync(join(dir, "node_modules/void-fbtee"));
      check(
        run(...exec(app.pm, "void-fbtee", "--help"), dir, { capture: true }).includes(
          "void-fbtee init",
        ),
        "void-fbtee --help",
      );
    });

    if (app.written) {
      thaiSource(step, target, dir, app, () => installed);
      return;
    }

    step("void-fbtee init sets the app up and installs what it added", () => {
      // void-fbtee's own pages and Void's docs examples (e2e/fresh/app/: pages/, routes/, crons/),
      // there before init, as a developer's own pages are: with a home under pages/[lang]/, init
      // adds the not-found and error pages.
      cpSync(join(import.meta.dirname, "app"), dir, { recursive: true });
      // The example's languages (its translations are copied in below); init adds the plugin,
      // middleware, flags and peers, and installs them (no install after it, as a developer
      // follows init's own words).
      const said = run(
        ...exec(app.pm, "void-fbtee", "init", "--locales", TRANSLATED.join(",")),
        dir,
        { capture: true },
      );
      console.error(said);
      moveStarterHome(dir, said);
      const fbtee = textField(readObject(join(dir, "node_modules/fbtee/package.json")), "version");
      console.error(`fbtee installed: ${fbtee}`);
      check(/^6\.\d+\.\d+$/.test(fbtee ?? ""), `init installed fbtee 6.x (${fbtee})`);
      check(
        said.includes("translating as you work (vp dev), on this machine:"),
        "init names the translators",
      );
      if (app.noTranslator) {
        check(
          said.includes("Gemini, through Void's AI: no") &&
            said.includes("Claude Code: no signed-in claude here") &&
            said.includes("With neither, vp dev translates nothing"),
          "init says there's no translator here, and what that means",
        );
      }
      // Zod for the form's validator, as Void's docs leave the library to the developer
      // (guide/server-routing.md, "Manual validators").
      run(
        app.pm,
        app.pm === "npm" ? ["install", "zod"] : ["add", "zod", "--no-frozen-lockfile"],
        dir,
      );
      checkOwnDependencies(dir, installed);
    });

    if (app.noTranslator) {
      step("vp dev serves, and makes each language's catalog", async () => {
        await withDev(app, dir, async (_base, page) => {
          check((await page("/en-US")).includes("<html"), "dev serves /en-US");
        });
        check(
          TRANSLATED.every((l) => existsSync(join(dir, `i18n/translations/${l}.json`))),
          "vp dev made each language's catalog as it started",
        );
      });
      step("vp build stops, and says how to translate", () => {
        const out = failing(...exec(app.pm, "vp", "build"), dir);
        check(out.includes("to fix before this can build"), "vp build fails while untranslated");
        check(
          out.includes("vp dev translates these after each save") &&
            out.includes("Without them, write the translations by hand"),
          "and names both translators, and the way by hand",
        );
      });
      return;
    }

    step("vp build (translations checked) and tsc pass", () => {
      // The example's translations of the strings.
      cpSync(join(root, "apps/example/i18n"), join(dir, "i18n"), { recursive: true });
      run(...exec(app.pm, app.toolchain === "vite-plus" ? "vp" : "vite", "build"), dir);
      run(...exec(app.pm, "tsc", "--noEmit"), dir);
    });

    step("routes and languages are typed", () => checkTypes(dir, app.pm));
    if (app.toolchain === "vite-plus") {
      step("vp lint reports fbtee's rules", () => checkLint(dir, app.pm));
      step("everything init wrote is formatted", () => checkFormatting(dir, app.pm));
    }
    step("the dev server, in Thai and Arabic", () => checkDev(dir, app));
    if (target === "vite-plus-npm") {
      macLockfile(step, dir);
    }
  });
}

/**
 * An app written in Thai: init with `--source-locale th-TH`, its pages (e2e/fresh/thai/), init's
 * own pages rewritten in Thai as its to-do asks, `vp dev` (which prepares), a build that fails
 * until the strings are translated, the translations, a build that passes, and the
 * dev server in all three languages, with "/" following the browser and Thai the fallback, and
 * then with `fallbackLocale: "en-US"`. It has no Zod, so it also checks the
 * build without it under `pnpm exec`, whose NODE_PATH once made void-fbtee think Zod was there.
 */
function thaiSource(
  step: ReturnType<typeof steps>,
  target: string,
  dir: string,
  app: App,
  installed: () => string,
) {
  const source = got(app.written);
  step(`void-fbtee init --source-locale ${source}`, () => {
    cpSync(join(import.meta.dirname, "thai"), dir, { recursive: true });
    const said = run(
      ...exec(app.pm, "void-fbtee", "init", "--source-locale", source, "--locales", "en-US,ar-EG"),
      dir,
      { capture: true },
    );
    check(
      said.includes(`write it in ${source}`),
      `init says its own pages' English text is to be written in ${source}`,
    );
    moveStarterHome(dir, said);
    // As the developer does: init's not-found and error pages in Thai, the app's language, as its
    // to-do asks (an English string in a Thai app would be "still the source" in English).
    const notFound = join(dir, "pages/_not-found.tsx");
    writeFileSync(
      notFound,
      readFileSync(notFound, "utf8")
        .replaceAll("There's nothing here", "ไม่มีอะไรอยู่ที่นี่")
        .replace(">Home</fbt>", ">หน้าแรก</fbt>"),
    );
    const error = join(dir, "pages/_error.tsx");
    writeFileSync(
      error,
      readFileSync(error, "utf8")
        .replaceAll("Something went wrong", "เกิดข้อผิดพลาด")
        .replace(
          "This page couldn't be made just now. Try again, or start from the home page.",
          "ตอนนี้สร้างหน้านี้ไม่ได้ ลองอีกครั้ง หรือเริ่มจากหน้าแรก",
        )
        .replace(">Try again</fbt>", ">ลองอีกครั้ง</fbt>"),
    );
    checkOwnDependencies(dir, installed());
  });

  step("vp dev makes each language's catalog as it starts", async () => {
    // `vp dev` prepares as it starts: each language's catalog, every string marked new. (CI is
    // set, so it starts no agent: it reports.)
    await withDev(app, dir, async (_base, page) => void (await page("/en-US")));
    check(existsSync(join(dir, "i18n/translations/en-US.json")), "the en-US catalog");
  });

  step("vp build fails while strings are untranslated", () => {
    check(
      /untranslated|not translated|to fix before this can build/.test(
        failing(...exec(app.pm, "vp", "build"), dir),
      ),
      "vp build fails",
    );
    check(
      !existsSync(join(dir, `i18n/translations/${source}.json`)),
      "no catalog for Thai, the source: it writes every count one way",
    );
  });

  step("translated, it builds and typechecks", () => {
    for (const [locale, texts] of Object.entries(FROM_THAI)) {
      const file = join(dir, `i18n/translations/${locale}.json`);
      const catalog = readCatalog(readFileSync(file, "utf8"), file);
      for (const entry of Object.values(catalog.translations)) {
        const first = entry.translations?.[0];
        const wanted = texts[first?.translation ?? ""];
        if (first === undefined || wanted === undefined) {
          continue;
        }
        if (typeof wanted === "string") {
          first.translation = wanted;
        } else {
          for (const line of entry.translations ?? []) {
            const form = wanted[Number(Object.values(line.variations)[0])];
            if (form === undefined) {
              throw new Error(`${locale}: no form for ${JSON.stringify(line.variations)}`);
            }
            line.translation = form;
          }
        }
        entry.status = "translated";
        // As the agent marks what it translated (void-fbtee's skill): the build asks who.
        entry.translatedBy = "claude";
      }
      writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    }
    // The rest (init's error page, still in English, and fbtee's built-in strings) keep the text
    // prepare gave them: this check is about the pages above, so they're only marked done.
    for (const locale of Object.keys(FROM_THAI)) {
      const file = join(dir, `i18n/translations/${locale}.json`);
      const catalog = readCatalog(readFileSync(file, "utf8"), file);
      for (const entry of Object.values(catalog.translations)) {
        if (entry.status === "new") {
          entry.status = "translated";
          entry.translatedBy = "claude";
        }
      }
      writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    }
    run(...exec(app.pm, "vp", "build"), dir);
    run(...exec(app.pm, "tsc", "--noEmit"), dir);
  });

  translatedContent(step, dir, app);

  const homeFor = (base: string, accept?: string) =>
    fetch(`${base}/`, {
      redirect: "manual",
      headers: accept === undefined ? {} : { "accept-language": accept },
    }).then((r) => ({ status: r.status, to: r.headers.get("location") ?? "" }));

  step("the dev server in all three languages", () =>
    withDev(app, dir, async (base, page) => {
      const th = await page(`/${source}`);
      check(
        th.includes('<html lang="th-TH"') && th.includes("งานของชุมชน") && th.includes("เหลือ 3 ที่นั่ง"),
        "/th-TH is the code's own Thai",
      );
      const en = await page("/en-US");
      check(
        en.includes("Community events") && en.includes("3 seats left"),
        "/en-US is translated into English, by its plural form",
      );
      const ar = await page("/ar-EG");
      check(
        ar.includes('dir="rtl"') && ar.includes("فعاليات المجتمع") && ar.includes("تبقّت ٣ مقاعد"),
        `/ar-EG is in Arabic, right-to-left, with its "few" form for 3`,
      );
      const nothing = await fetch(`${base}/th-TH/no-such-page`);
      check(
        nothing.status === 404 && (await nothing.text()).includes("ไม่มีอะไรอยู่ที่นี่"),
        "the not-found page is in Thai",
      );
      for (const [accept, to] of [
        ["en-GB", "/en-US"],
        ["ar-SA", "/ar-EG"],
        ["fr", `/${source}`],
        [undefined, `/${source}`],
      ] as const) {
        const home = await homeFor(base, accept);
        check(
          home.status === 302 && home.to.endsWith(to),
          `"/" in ${accept ?? "no language"} goes to ${to} (302)`,
        );
      }
      check(
        th.includes(`hreflang="x-default" href="${base}/"`),
        `the home page's x-default is "/"`,
      );
      const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
      check(
        sitemap.includes('hreflang="th-TH"') && sitemap.includes('hreflang="en-US"'),
        "the sitemap lists every language",
      );
    }),
  );

  step(`with fallbackLocale "en-US", "/" in French goes to /en-US`, async () => {
    // The same app, with English for visitors it has no language for.
    const viteConfig = join(dir, "vite.config.ts");
    const config = readFileSync(viteConfig, "utf8");
    check(config.includes("voidFbtee({"), `${target}: vite.config.ts calls voidFbtee({ … })`);
    writeFileSync(
      viteConfig,
      config.replace("voidFbtee({", 'voidFbtee({ fallbackLocale: "en-US",'),
    );
    try {
      await withDev(app, dir, async (base, page) => {
        await page(`/${source}`);
        const french = await homeFor(base, "fr");
        check(
          french.status === 302 && french.to.endsWith("/en-US"),
          `"/" in French goes to /en-US`,
        );
        const thai = await homeFor(base, "th");
        check(thai.to.endsWith(`/${source}`), `and a Thai browser still to /${source}`);
      });
    } finally {
      writeFileSync(viteConfig, config);
    }
  });
}

/**
 * Void's starter page at "/" (pages/index.tsx, from `void init`): "/" now sends each visitor to
 * their language, so init says it's hidden, and the developer moves the home under pages/[lang]/
 * (the fresh apps have theirs already) and deletes it, as done here.
 */
function moveStarterHome(dir: string, said: string) {
  const starter = join(dir, "pages/index.tsx");
  if (!existsSync(starter)) {
    return;
  }
  check(
    said.includes(`pages/index.tsx: hidden, since "/" sends each visitor to their own language`),
    `init says Void's starter page at "/" is hidden`,
  );
  rmSync(starter);
}

/** The app's dev server, until `use` is done: `page` waits for a path to answer. */
async function withDev(
  app: App,
  dir: string,
  use: (base: string, page: (path: string) => Promise<string>) => Promise<void>,
) {
  const cli = app.toolchain === "vite-plus" ? "vp" : "vite";
  const server = spawn(
    app.pm,
    ["exec", "--", cli, "dev", "--port", String(app.port), "--strictPort"],
    { cwd: dir, env, stdio: ["ignore", "ignore", "inherit"], detached: true },
  );
  const base = `http://localhost:${app.port}`;
  try {
    const page = async (path: string) => {
      for (let i = 0; i < 300; i++) {
        try {
          const res = await fetch(`${base}${path}`);
          if (res.ok) {
            return await res.text();
          }
        } catch {
          // The server isn't answering yet: ask again.
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return "";
    };
    await use(base, page);
  } finally {
    if (server.pid) {
      process.kill(-server.pid, "SIGTERM");
    }
    // The port free again before the next server starts.
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(base);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/** Strict settings, as Void's: engines must match, and (pnpm) peers must be met. */
function strict(dir: string, pm: Pm) {
  if (pm === "npm") {
    writeFileSync(join(dir, ".npmrc"), "engine-strict=true\naudit=false\nfund=false\n");
    return;
  }
  const file = join(dir, "pnpm-workspace.yaml");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  // One known gap, allowed by name so any other unmet peer still fails: fbtee's lint plugin
  // (which init adds on Vite+) uses typescript-eslint, whose packages want TypeScript below 6.1,
  // and a new Void app has TypeScript 7 (typescript-eslint#12518; it waits on TypeScript 7.1's
  // API). The rules work: checkLint runs one.
  const ts7 = ["utils", "typescript-estree", "project-service", "tsconfig-utils"].map(
    (p) => `    "@typescript-eslint/${p}>typescript": "7"`,
  );
  // Into the block `void init` writes on Vite+ (for vite: "*"), or a new one.
  const block = "peerDependencyRules:\n  allowedVersions:\n";
  const rules = text.includes(block)
    ? text.replace(block, `${block}${ts7.join("\n")}\n`)
    : `${text.trimEnd()}\n${block}${ts7.join("\n")}\n`;
  writeFileSync(file, `${rules.trimEnd()}\nstrictPeerDependencies: true\nengineStrict: true\n`);
}

function npmVersion(): string {
  return execFileSync("npm", ["--version"], { env, encoding: "utf8" }).trim();
}

/** pnpm-workspace.yaml's allowBuilds as `void init` writes it on Vite+, for the plain-Vite app. */
function allowBuild(dir: string) {
  const file = join(dir, "pnpm-workspace.yaml");
  const builds = Object.entries(VOID_INIT_BUILDS);
  writeFileSync(file, `allowBuilds:\n${builds.map(([k, v]) => `  "${k}": ${v}`).join("\n")}\n`);
}

/** The modules a file imports: import and export-from statements, and import() with a string. */
function importsOf(code: string): Array<string> {
  const found: Array<string> = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      return node.forEach(walk);
    }
    const n = {
      type: textField(node, "type"),
      source: {
        type: textField(field(node, "source"), "type"),
        value: field(field(node, "source"), "value"),
      },
    };
    if (
      (n.type === "ImportDeclaration" ||
        n.type === "ExportNamedDeclaration" ||
        n.type === "ExportAllDeclaration" ||
        n.type === "ImportExpression") &&
      n.source?.type === "Literal" &&
      typeof n.source.value === "string"
    ) {
      found.push(n.source.value);
    }
    for (const value of Object.values(node)) {
      walk(value);
    }
  };
  walk(parseAst(code));
  return found;
}

/** Every package void-fbtee's built code imports resolves inside the app (not in this repo's). */
function checkOwnDependencies(dir: string, installed: string) {
  const specifiers = new Set<string>();
  // Real imports only, read by Vite's own parser: the plugin also holds code it writes into an app
  // (`export { default } from "@void/md/pages"`, only when the app has @void/md), which is text in
  // a string, not an import of the package's.
  for (const f of readdirSync(join(installed, "dist")).filter((f) => f.endsWith(".mjs"))) {
    for (const spec of importsOf(readFileSync(join(installed, "dist", f), "utf8"))) {
      if (!spec.startsWith(".")) {
        specifiers.add(spec);
      }
    }
  }
  const outside: Array<string> = [];
  for (const spec of specifiers) {
    if (spec.startsWith("node:") || spec.startsWith("virtual:")) {
      continue;
    }
    const name = spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : got(spec.split("/")[0]);
    // Node's lookup: the first node_modules/<name> walking up from the package's folder.
    let found: string | undefined;
    for (let d = installed; !found; d = dirname(d)) {
      const candidate = join(d, "node_modules", name);
      if (existsSync(candidate)) {
        found = realpathSync(candidate);
      }
      if (d === dirname(d)) {
        break;
      }
    }
    if (!found || !found.startsWith(realpathSync(dir))) {
      outside.push(`${spec} → ${found ?? "not found"}`);
    }
  }
  check(
    !outside.length,
    `void-fbtee's ${specifiers.size} imports resolve inside the app ${outside.join(", ")}`,
  );
}

/** Void's typed routes and void-fbtee's languages in a new app, as in the example: a link to a page
 * that exists type-checks; a missing page, and a language the app hasn't, don't. */
function checkTypes(dir: string, pm: Pm) {
  const probe = join(dir, "src/_TypesProbe.ts");
  const write = (body: string) =>
    writeFileSync(
      probe,
      `import { routeUrl } from "void/routes";\nimport type { Lang } from "void-fbtee/locales";\n${body}\n`,
    );
  const tsc = () => failing(...exec(pm, "tsc", "--noEmit"), dir);
  write(`export const home = routeUrl("/[lang]", { params: { lang: "th-TH" satisfies Lang } });`);
  check(!tsc(), "a link to a page that exists type-checks");
  write(`export const bad = routeUrl("/[lang]/no-such-page", { params: { lang: "th-TH" } });`);
  check(tsc().includes("_TypesProbe"), "a link to a missing page fails the type check");
  write(`export const lang: Lang = "xx-XX";\nexport const u = routeUrl;`);
  check(tsc().includes("_TypesProbe"), "a language the app hasn't fails the type check");
  // void-fbtee's routeUrl: the current language unless given, still checked against the app's
  // routes; and its revalidate, which takes "/[lang]…" for every language.
  const typesOk = (body: string) => {
    writeFileSync(probe, `${body}\n`);
    return !tsc();
  };
  check(
    typesOk(`import { routeUrl } from "void-fbtee/routes";
export const home = routeUrl("/[lang]");
export const form = routeUrl("/[lang]/form", { params: { lang: "ar-EG" } });`),
    "void-fbtee's routeUrl type-checks with no lang, or with one",
  );
  check(
    !typesOk(
      `import { routeUrl } from "void-fbtee/routes";\nexport const bad = routeUrl("/[lang]/no-such-page");`,
    ),
    "void-fbtee's routeUrl to a missing page fails the type check",
  );
  check(
    typesOk(`import { revalidate } from "void-fbtee/server";
export const clear = () => revalidate({ paths: ["/[lang]", "/[lang]/form"] });`),
    `revalidate() takes a page in every language ("/[lang]…")`,
  );
  rmSync(probe);
}

/** init's lint wiring, in Vite+ itself: the example passes, a probe fbtee's prefer-fbs catches fails. */
function checkLint(dir: string, pm: Pm) {
  run(...exec(pm, "vp", "lint", "pages"), dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  const probe = join(dir, "components/_LintProbe.tsx");
  writeFileSync(
    probe,
    `import { fbt } from "fbtee";\nexport const probe = () => String(fbt("Lint probe", "Lint probe: a heading"));\n`,
  );
  const output = failing(...exec(pm, "vp", "lint", "components/_LintProbe.tsx"), dir);
  rmSync(probe);
  check(output.includes("@nkzw/fbtee(prefer-fbs)"), "vp lint reports @nkzw/fbtee(prefer-fbs)");
}

/** After void-fbtee init, `vp fmt --check` (what `vp check` runs first) is clean: nothing init
 * wrote or changed fails a Vite+ developer's `vp check`. */
function checkFormatting(dir: string, pm: Pm) {
  const out = failing(...exec(pm, "vp", "fmt", "--check"), dir);
  const files = [...out.matchAll(/^(\S+) \(\d+ms\)$/gm)].map((m) => got(m[1])).sort();
  check(!files.length, `everything init wrote is formatted ${files.join(", ")}`);
}

/** The dev server: translated pages, Void's docs examples in Thai (and the known gaps), an Arabic
 * page right-to-left, "/" to the visitor's language, and a language the app hasn't not found. */
function checkDev(dir: string, app: App) {
  return withDev(app, dir, async (base, page) => {
    const html = await page("/th-TH");
    check(html.includes("i18n สำหรับแอป Void"), "dev serves /th-TH in Thai");
    // Void's docs examples (e2e/fresh/app/), each in a language other than the source.
    check(
      html.includes("<title>i18n สำหรับแอป Void</title>"),
      "head() from Void's docs gives the title in Thai",
    );
    check(
      html.includes('data-testid="loader-locale">th-TH<'),
      "a loader from Void's docs has the page's language",
    );
    check(
      html.includes('href="/th-TH/form" data-testid="form-link"'),
      "a link built with no language given is in the page's (routeUrl)",
    );
    const thai = /[฀-๿]/;
    const form = await fetch(`${base}/th-TH/form`, {
      method: "POST",
      // As useForm sends it (@void/react).
      headers: { "Content-Type": "application/json", "X-VoidPages": "true" },
      body: JSON.stringify({ name: "" }),
    });
    const nameError =
      form.status === 422 ? textField(field(parseJson(await form.text()), "errors"), "name") : "";
    check(
      thai.test(nameError ?? ""),
      `a form from Void's docs shows Zod's validation error in Thai ("${nameError}")`,
    );
    const nothing = await fetch(`${base}/th-TH/no-such-page`);
    const nothingHtml = await nothing.text();
    check(
      nothing.status === 404 &&
        nothingHtml.includes("ไม่มีอะไรอยู่ที่นี่") &&
        nothingHtml.includes("<title>ไม่มีอะไรอยู่ที่นี่</title>"),
      "an address with nothing at it gets init's not-found page in Thai, title too",
    );
    const sitemap = await fetch(`${base}/sitemap.xml`);
    const sitemapXml = sitemap.ok ? await sitemap.text() : "";
    check(
      sitemapXml.includes("/th-TH/form</loc>") &&
        sitemapXml.includes('hreflang="th-TH"') &&
        sitemapXml.includes('hreflang="x-default"'),
      "init's /sitemap.xml lists every page in every language",
    );
    // Void's scheduled job example (crons/hourly-heartbeat.ts), run as Void's docs say to locally
    // (guide/jobs.md, "Local development"), with the token Void keeps in .void/. The job throws
    // unless inLocale() gave it Thai, and Void reports a job that throws.
    const token = readFileSync(join(dir, ".void/dev-trigger-token"), "utf8").trim();
    const job = await fetch(`${base}/__void/scheduled`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-void-dev-trigger": token },
      body: JSON.stringify({ cron: "0 * * * *", scheduledTime: Date.now() }),
    });
    const ran = await job.text();
    check(
      job.ok && field(parseJson(ran), "ok") === true,
      `a scheduled job from Void's docs translates with inLocale(), with no request ${ran}`,
    );
    const api = await fetch(`${base}/api/hello`, { headers: { "Accept-Language": "th-TH" } });
    const answer = parseJson(await api.text());
    const hello = { locale: textField(answer, "locale"), message: textField(answer, "message") };
    gap(
      hello.locale === "th-TH" && thai.test(hello.message ?? ""),
      `a server route from Void's docs answers in the language asked for (got ${hello.locale})`,
      10,
    );
    const ar = await (await fetch(`${base}/ar-EG`)).text();
    check(
      ar.includes('<html lang="ar-EG" dir="rtl"') && ar.includes("تدويل تطبيقات Void"),
      "dev serves /ar-EG right-to-left, in Arabic",
    );
    const home = await fetch(`${base}/`, {
      redirect: "manual",
      headers: { "accept-language": "th-TH,th;q=0.9" },
    });
    check(
      home.status === 302 && home.headers.get("location")?.endsWith("/th-TH"),
      `"/" in Thai goes to /th-TH (302)`,
    );
    const madeUp = await fetch(`${base}/xx-XX`, { redirect: "manual" });
    check(madeUp.status === 404, "a language the app hasn't (/xx-XX) is not found");
  });
}

/**
 * A Mac developer with Linux CI, on npm: the lockfile is written as on a Mac (npm's --os/--cpu),
 * including a later install with node_modules present (where npm/cli#4828 drops other systems'
 * builds of native packages), then `npm ci` and a build here. fbtee's compiler is native code, one
 * build per system (@nkzw/oxc-transform-fbtee-binding-*).
 */
function macLockfile(step: ReturnType<typeof steps>, dir: string) {
  step("npm ci with a lockfile made on a Mac", () => {
    // Only the lockfile a Mac writes: install scripts (workerd's checks its build) run on the Mac,
    // against its own builds, so not here. `npm ci` below runs them, as Linux CI does.
    const mac = ["--os=darwin", "--cpu=arm64", "--ignore-scripts"];
    rmSync(join(dir, "node_modules"), { recursive: true, force: true });
    rmSync(join(dir, "package-lock.json"), { force: true });
    run("npm", ["install", ...mac], dir);
    run("npm", ["install", ...mac, "ms@2.1.3"], dir);
    rmSync(join(dir, "node_modules"), { recursive: true, force: true });
    const ci = failing("npm", ["ci"], dir);
    check(!ci, `npm ci ${ci.split("\n").slice(-3).join(" ")}`);
  });
  step("and it builds", () => {
    const build = failing(...exec("npm", "vp", "build"), dir);
    check(!build, `it builds ${build.split("\n").slice(-5).join(" ")}`);
  });
}

/**
 * What people write, translated by the package (plans/types-from-schema.md,
 * plans/like-better-auth.md), as a developer adds it to a new app: a table of their own, then
 * `void-fbtee gen translations` writes the kept translations table and the app's files at Void's
 * places (src/content.ts, the queue, the job, the middleware given the content), `void db generate`
 * makes the table's migration, and the app builds and typechecks: every type it uses comes from its
 * own schema. Then the build fails while the queue is missing.
 */
function translatedContent(step: ReturnType<typeof steps>, dir: string, app: App) {
  step("gen translations writes the app's files for a table", () => {
    mkdirSync(join(dir, "db/schema"), { recursive: true });
    writeFileSync(
      join(dir, "db/schema/notes.ts"),
      [
        'import { sqliteTable, text } from "void/schema-d1";',
        "",
        'export const notes = sqliteTable("notes", {',
        '  id: text("id").primaryKey(),',
        '  locale: text("locale").notNull(),',
        '  body: text("body").notNull(),',
        "});",
        "",
      ].join("\n"),
    );
    writeFileSync(join(dir, "db/schema.ts"), 'export * from "./schema/notes";\n');
    run(...exec(app.pm, "vp", "exec", "void-fbtee", "gen", "translations", "notes", "body"), dir);
    for (const file of [
      "db/schema/notes_translations.ts",
      "src/content.ts",
      "queues/translate.ts",
      "crons/translations.ts",
    ]) {
      check(existsSync(join(dir, file)), `gen translations wrote ${file}`);
    }
    check(
      readFileSync(join(dir, "db/schema.ts"), "utf8").includes("./schema/notes_translations"),
      "gen translations re-exported the translations table from db/schema.ts",
    );
    check(
      readFileSync(join(dir, "middleware/99.i18n.ts"), "utf8").includes(
        "i18nMiddleware({ content })",
      ),
      "gen translations gave the middleware the content",
    );
  });
  step("with its migration, it builds and typechecks", () => {
    run(...exec(app.pm, "vp", "exec", "void", "db", "generate"), dir);
    run(...exec(app.pm, "vp", "build"), dir);
    run(...exec(app.pm, "tsc", "--noEmit"), dir);
  });
  step("vp build fails while queues/translate.ts is missing, naming it", () => {
    // The app's own files are checked, as Void wires Better Auth's routes itself
    // (plans/like-better-auth.md): without the queue, the build fails, naming it.
    const queue = join(dir, "queues/translate.ts");
    const own = readFileSync(queue, "utf8");
    rmSync(queue);
    try {
      check(
        /queues\/translate\.ts doesn't run void-fbtee's queue/.test(
          failing(...exec(app.pm, "vp", "build"), dir),
        ),
        "vp build names queues/translate.ts",
      );
    } finally {
      writeFileSync(queue, own);
    }
  });
}

/**
 * Two upstream releases break every new Void 1.8.0 app, void-fbtee or not (README "Reported to
 * Void"), so the fresh apps use the versions this repo has:
 * - Void asks for "@cloudflare/vite-plugin": "^2.0.0-beta.v.15", which also takes 2.0.0-rc.0
 *   (2026-11-17); that writes its build to .cloudflare/output/v1 where Void reads v0 ("no root
 *   config found"). Pinned to this repo's version (pnpm-workspace.yaml's overrides, since a new app has no
 *   lockfile), the way each package manager pins one:
 *   pnpm's overrides in pnpm-workspace.yaml, npm's in package.json.
 * - `void init` writes "vite-plus": "^1.6.0" and "vite": "npm:@voidzero-dev/vite-plus-core@^1.6.0".
 *   Vite+ 1.7.0 (2026-11-17) needs its core at 8.3.8000, which that range can't take, so
 *   `vp build` stops ("Failed to resolve vite command"). Pinned to the catalog in
 *   pnpm-workspace.yaml, in the app's own devDependencies (Vite+ apps only).
 */
function pinUpstream(dir: string, pm: Pm) {
  const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const pinned = (name: string) =>
    new RegExp(`^  "?${name.replace(/[/@.]/g, "\\$&")}"?: (.+)$`, "m").exec(workspace)?.[1] ??
    (() => {
      throw new Error(`no ${name} in pnpm-workspace.yaml`);
    })();
  const version = pinned("@cloudflare/vite-plugin");
  const pkgFile = join(dir, "package.json");
  const pkg = readObject(pkgFile);
  const dev = textRecord(pkg.devDependencies);
  if (dev["vite-plus"]) {
    pkg.devDependencies = { ...dev, "vite-plus": pinned("vite-plus"), vite: pinned("vite") };
  }
  if (pm === "pnpm") {
    const file = join(dir, "pnpm-workspace.yaml");
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    const line = `  "@cloudflare/vite-plugin": ${version}`;
    writeFileSync(
      file,
      /^overrides:$/m.test(text)
        ? text.replace(/^overrides:$/m, `overrides:\n${line}`)
        : `${text.replace(/\n*$/, "\n")}overrides:\n${line}\n`,
    );
  } else {
    pkg.overrides = {
      ...(isRecord(pkg.overrides) ? pkg.overrides : {}),
      "@cloudflare/vite-plugin": version,
    };
  }
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
}
