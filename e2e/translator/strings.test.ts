// The translator test: Void's AI, on the dev server, translating the test app's strings
// (packages/void-fbtee/test/translator/: app/src/strings.tsx, fbtee strings in real code) into every
// language the app has, exactly as `vp dev` does: translateWithVoidAi on the app's own fbtee
// catalogs, with each language's model (models.json). Each string is reset to "new" on its own
// (its source text on every line, as fbtee's prepare writes a new one), the rest of the catalog
// staying translated, so the examples and glossary are the catalog's own, as in a real app. The
// translation the catalog had is the reference. Each answer:
// - with problems (judge.ts: wrong script, English left, a placeholder or command changed), or one
//   a person marked wrong (verdicts.json): fails the test; marked right: passes;
// - nobody has judged it: listed as unreviewed, lowest signals first, for a person to read;
// - signals, recorded, never failing: the meaning score (ai.ts meaningScores) and chrF against the
//   reference (score.ts).
// Everything goes to test/translator/scores.json, committed: the git diff is what changed.
//
// AI Gateway's cache is set per string by verdicts.json: on for a string with an answer judged
// right (settled, so a rerun gets it back cheaply), off for the rest, so a wrong or unjudged one
// is asked fresh every run and never handed back from the cache. TRANSLATOR_LANGUAGES picks languages;
// TRANSLATOR_MODEL tries another model, scored as "<language> <model>". `vp run test:translator`.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, inject, test } from "vite-plus/test";
import { catalogFile, collect } from "../../packages/void-fbtee/src/catalogs";
import { loadProject } from "../../packages/void-fbtee/src/commands";
import { modelFor } from "../../packages/void-fbtee/src/models";
import { translateWithVoidAi } from "../../packages/void-fbtee/src/translate";
import { chrF } from "../../packages/void-fbtee/test/translator/score";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;
const DATA = join(import.meta.dirname, "../../packages/void-fbtee/test/translator");
const SCORES = join(DATA, "scores.json");
const MODEL = process.env.TRANSLATOR_MODEL;

// A copy of the test app, inside the package so fbtee resolves from its node_modules.
const app = mkdtempSync(join(DATA, ".tmp-"));
cpSync(join(DATA, "app"), app, { recursive: true });
afterAll(() => rmSync(app, { recursive: true, force: true }));
const p = await loadProject(app);
const { texts, builtinHashes } = collect(p);
const LANGUAGES =
  process.env.TRANSLATOR_LANGUAGES?.split(",") ??
  p.config.locales.map((l) => l.locale).filter((l) => l !== p.config.sourceLocale);

type Line = { translation: string; variations: Record<string, number> };
type Catalog = { translations: Record<string, { status?: string; translations: Line[] }> };
type Verdict = { answer: string; right: boolean; why?: string; by: string };
const VERDICTS = JSON.parse(readFileSync(join(DATA, "verdicts.json"), "utf8")) as Record<
  string,
  Record<string, Verdict[]>
>;

interface Result {
  text: string;
  hash: string;
  cache: boolean;
  verdict: "right" | "wrong" | "unreviewed";
  why?: string;
  meaning?: number;
  chrF?: number;
  reference: string[];
  got: string[];
}

for (const to of LANGUAGES) {
  test.skipIf(!!skip)(
    `Void's AI translates the test strings into ${to} (${MODEL ?? modelFor(to).id})`,
    async () => {
      const token = readFileSync(
        join(EXAMPLE, "node_modules/.void-fbtee/dev-token"),
        "utf8",
      ).trim();
      const url = `${site}/__void-fbtee/translate`;
      const file = catalogFile(p, to);
      const reference = readFileSync(file, "utf8");
      const results: Result[] = [];
      for (const hash of Object.keys((JSON.parse(reference) as Catalog).translations)) {
        if (builtinHashes.has(hash)) continue;
        // This string new again, the rest as they were.
        const catalog = JSON.parse(reference) as Catalog;
        const entry = catalog.translations[hash]!;
        const ref = entry.translations.map((l) => l.translation);
        entry.translations = entry.translations.map((l) => ({ ...l, translation: texts[hash]! }));
        entry.status = "new";
        writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
        // Cached only once an answer to it was judged right (verdicts.json).
        const cache = VERDICTS[to]?.[hash]?.some((v) => v.right) ?? false;
        const log: string[] = [];
        const ran = await translateWithVoidAi(p, url, token, (l) => log.push(l), {
          cache,
          model: MODEL,
        });
        expect(ran, `Void's AI isn't available: ${log.join(" ")}`).toBe(true);
        const after = (JSON.parse(readFileSync(file, "utf8")) as Catalog).translations[hash]!;
        const kept = after.status === "translated";
        const got = kept ? after.translations.map((l) => l.translation) : [];
        const score =
          got.length === ref.length
            ? Math.round(got.reduce((a, l, i) => a + chrF(l, ref[i]!), 0) / got.length)
            : undefined;
        const res = got.length
          ? await fetch(url, {
              method: "POST",
              headers: { "content-type": "application/json", "x-void-fbtee-token": token },
              body: JSON.stringify({ kind: "meaning", pairs: got.map((l) => [texts[hash]!, l]) }),
            })
          : undefined;
        const scores = ((await res?.json()) as { scores?: number[] } | undefined)?.scores ?? [];
        const meaning = scores.length
          ? Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length)
          : undefined;
        const judged = VERDICTS[to]?.[hash]?.find((v) => v.answer === got.join("\n"));
        results.push({
          text: texts[hash]!,
          hash,
          cache,
          // Not kept: vp dev's judge found problems it couldn't get fixed (the log says which).
          verdict: !kept ? "wrong" : judged ? (judged.right ? "right" : "wrong") : "unreviewed",
          ...(!kept && { why: log.join(" ") || "not kept" }),
          ...(judged && !judged.right && { why: judged.why }),
          ...(meaning !== undefined && { meaning }),
          ...(score !== undefined && { chrF: score }),
          reference: ref,
          got,
        });
      }
      writeFileSync(file, reference);
      const count = (v: Result["verdict"]) => results.filter((r) => r.verdict === v).length;
      const mean = (k: "meaning" | "chrF") => {
        const xs = results.flatMap((r) => (r[k] === undefined ? [] : [r[k]!]));
        return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined;
      };
      const unreviewed = results
        .filter((r) => r.verdict === "unreviewed")
        .sort((a, b) => (a.meaning ?? 0) + (a.chrF ?? 0) - ((b.meaning ?? 0) + (b.chrF ?? 0)))
        .map((r) => r.text);
      for (const r of results)
        console.log(
          `${to} ${r.verdict === "wrong" ? "✗" : r.verdict === "right" ? "✓" : "?"} ${r.text} (meaning ${r.meaning ?? "-"}, chrF ${r.chrF ?? "-"}): ${r.got.join(" | ")}`,
        );
      const all = existsSync(SCORES)
        ? (JSON.parse(readFileSync(SCORES, "utf8")) as Record<string, unknown>)
        : {};
      all[MODEL ? `${to} ${MODEL}` : to] = {
        date: new Date().toISOString().slice(0, 10),
        model: MODEL ?? modelFor(to).id,
        right: count("right"),
        wrong: count("wrong"),
        unreviewed,
        meaning: mean("meaning"),
        chrF: mean("chrF"),
        results,
      };
      writeFileSync(
        SCORES,
        JSON.stringify(
          Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))),
          null,
          2,
        ) + "\n",
      );
      expect(
        results.filter((r) => r.verdict === "wrong").map((r) => `${r.text}: ${r.why}`),
        `${to}: wrong answers`,
      ).toEqual([]);
    },
  );
}
