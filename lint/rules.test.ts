// The lint rules proven to work, not trusted (plans/checked-everywhere.md): a file breaking each
// rule is written into every folder of the repo, `vp lint` (the repo's own settings) is run on
// them, and each folder must report every rule. A rule switched off, misspelled, or doing nothing,
// or a folder the rules (or TypeScript's settings) don't reach, fails here. Then every exception in
// the repo (a disable comment) is listed and compared with the known ones, each with its reason.
import { execFileSync } from "node:child_process";
import { globSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vite-plus/test";

const ROOT = resolve(import.meta.dirname, "..");

/** Every folder with its own code, each under the tsconfig that checks it. */
const FOLDERS = [
  ".",
  "lint",
  "scripts",
  "e2e",
  "apps/example",
  "apps/example/src",
  "apps/example/scripts",
  "packages/void-fbtee",
  "packages/void-fbtee/src",
  "packages/void-fbtee/test/unit",
];

/** One line (or a few) breaking each rule, and the name the rule reports under. */
const VIOLATIONS: Array<{ rule: string; code: string }> = [
  { rule: "consistent-type-assertions", code: `export const cast = 1 as unknown;` },
  { rule: "no-explicit-any", code: `export const loose = (x: any): unknown => x;` },
  { rule: "no-unsafe-assignment", code: `const parsed = JSON.parse("{}");` },
  { rule: "no-unsafe-member-access", code: `export const member: unknown = parsed.x;` },
  { rule: "no-unsafe-call", code: `export const called = (): unknown => parsed.f();` },
  { rule: "no-unsafe-return", code: `export const returned = () => JSON.parse("1");` },
  { rule: "no-unsafe-argument", code: `export const argument = String.fromCharCode(parsed);` },
  {
    rule: "no-non-null-assertion",
    code: `const list: Array<string> = [];\nexport const asserted = list[0]!;`,
  },
  // TypeScript's noUncheckedIndexedAccess: list[0] may be nothing, so it isn't a string.
  { rule: "TS2322", code: `export const first: string = list[0];` },
  {
    rule: "no-floating-promises",
    code: `export async function forgot() {\n  Promise.resolve(1);\n}`,
  },
  // A disable comment that names no rule turns every rule off.
  { rule: "no-abusive-eslint-disable", code: `// oxlint-disable-next-line\nexport const off = 1;` },
];

const PROBE = "zz-lint-probe.ts";

test("every rule reports in every folder", () => {
  const files = FOLDERS.map((folder) => join(folder, PROBE));
  const code = VIOLATIONS.map((v) => v.code).join("\n") + "\n";
  let report = "";
  try {
    for (const file of files) {
      writeFileSync(join(ROOT, file), code);
    }
    try {
      execFileSync("vp", ["lint", "--format", "unix", ...files], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      // vp lint exits non-zero when it finds something, as it must here.
      const out: unknown = error instanceof Error ? Reflect.get(error, "stdout") : undefined;
      report = typeof out === "string" ? out : "";
    }
  } finally {
    for (const file of files) {
      rmSync(join(ROOT, file), { force: true });
    }
  }
  const missing = files.flatMap((file) => {
    const lines = report.split("\n").filter((l) => l.startsWith(`${file.replace(/^\.\//, "")}:`));
    return VIOLATIONS.filter((v) => !lines.some((l) => l.includes(`(${v.rule})`))).map(
      (v) => `${file}: ${v.rule}`,
    );
  });
  expect(report, "vp lint reported nothing").not.toBe("");
  expect(missing).toEqual([]);
});

/** Each exception the repo makes, by file and rule. A new one fails here until it's listed. */
const EXCEPTIONS = [
  "apps/example/src/docs/intl.tsx no-base-to-string",
  "packages/void-fbtee/src/locales.ts no-empty-interface",
  "packages/void-fbtee/src/locales.ts typescript/no-namespace",
  "packages/void-fbtee/src/react.tsx no-redundant-type-constituents",
  "packages/void-fbtee/src/react.tsx typescript/consistent-type-assertions",
  "packages/void-fbtee/src/routes.ts typescript/consistent-type-assertions",
  "packages/void-fbtee/src/server.ts no-redundant-type-constituents",
  "packages/void-fbtee/test/unit/fbtee-run.ts no-implied-eval",
];

test("every exception is a known one, and says why", () => {
  const sources = globSync("**/*.{ts,tsx,mts,mjs,js}", {
    cwd: ROOT,
    exclude: (name) => ["node_modules", ".vitest", ".void", "dist", ".cloudflare"].includes(name),
  }).filter((f) => f !== "lint/rules.test.ts");
  const found: Array<string> = [];
  const unexplained: Array<string> = [];
  for (const file of sources) {
    for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
      const disable = line.match(
        /(?:oxlint|eslint)-disable(?:-next-line|-line)?\s+([^\s-][^\s]*)?(.*)/,
      );
      if (!disable || !line.trim().startsWith("//")) {
        continue;
      }
      found.push(`${file} ${disable[1] ?? "(every rule)"}`);
      if (!/\s--\s+\S/.test(disable[2] ?? "")) {
        unexplained.push(`${file}: ${line.trim()}`);
      }
    }
  }
  expect(found.sort()).toEqual(EXCEPTIONS);
  expect(unexplained).toEqual([]);
});

// Code Playwright runs in the page (page.evaluate, $$eval, addInitScript, waitForFunction) is sent
// there as text: a name imported in the test file doesn't exist in the page, and Vitest renames
// imports, so using one fails only when the browser runs it ("__vite_ssr_import_4__ is not
// defined", 2026-11-19). TypeScript can't see this; this does.
test("code run in the page uses nothing imported", () => {
  const PAGE_CALL = /\b(addInitScript|\$\$eval|\$eval|evaluate|evaluateHandle|waitForFunction)\(/g;
  const found: Array<string> = [];
  for (const file of globSync("e2e/**/*.ts", { cwd: ROOT })) {
    const text = readFileSync(join(ROOT, file), "utf8");
    const imported = [...text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from/gm)]
      .flatMap((m) => (m[1] ?? "").split(","))
      .map(
        (n) =>
          n
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)
            .pop() ?? "",
      )
      .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
    for (const call of text.matchAll(PAGE_CALL)) {
      let depth = 1;
      let end = (call.index ?? 0) + call[0].length;
      while (depth > 0 && end < text.length) {
        depth += text[end] === "(" ? 1 : text[end] === ")" ? -1 : 0;
        end += 1;
      }
      const body = text.slice(call.index, end);
      for (const name of imported) {
        if (new RegExp(`(?<![\\w$.])${name.replace("$", "\\$")}\\(`).test(body)) {
          const line = text.slice(0, call.index).split("\n").length;
          found.push(`${file}:${line} ${call[1]} calls ${name}()`);
        }
      }
    }
  }
  expect(found).toEqual([]);
});
