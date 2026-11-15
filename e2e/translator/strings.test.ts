// The translator test: Void's AI, on the dev server, translating the package's English test
// strings (packages/void-fbtee/test/translator/strings.ts) into every language that has their
// references (references.ts), each with its own model (models.ts), exactly as `vp dev` translates
// a new string (translate.ts translateEntry: sent, judged, asked again with what was wrong), and
// with the help `vp dev` gives: the language's other test strings as examples, as a catalog's own
// translations would be. Each answer is judged (judge.ts):
// - problems (wrong script, text left in English, a placeholder or command changed) fail the test;
// - a person's verdict (verdicts.ts): an answer marked wrong fails, one marked right passes;
// - signals, recorded, never failing: the meaning score (ai.ts meaningScores: how close the
//   translation's meaning is to the source's) and the score against the reference (score.ts chrF).
// Answers nobody has judged are listed as unreviewed, lowest signals first, for a person to read.
// Everything goes to packages/void-fbtee/test/translator/scores.json, committed: the git diff is
// what changed.
//
// AI Gateway's cache is on (ai.ts ask): at temperature 0 a cached answer is the one the model gives
// anyway, so a rerun costs only what changed. TRANSLATOR_FRESH=1 turns it off, to see whether
// Cloudflare changed a model behind its name. TRANSLATOR_LANGUAGES picks languages;
// TRANSLATOR_MODEL tries another model, scored as "<language> <model>". `vp run test:translator`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import { keptTerms } from "../../packages/void-fbtee/src/judge";
import { modelFor } from "../../packages/void-fbtee/src/models";
import { translateEntry, translatingRules } from "../../packages/void-fbtee/src/translate";
import { REFERENCES } from "../../packages/void-fbtee/test/translator/references";
import { chrF } from "../../packages/void-fbtee/test/translator/score";
import { formsFor, STRINGS } from "../../packages/void-fbtee/test/translator/strings";
import { VERDICTS } from "../../packages/void-fbtee/test/translator/verdicts";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;
const SCORES = join(import.meta.dirname, "../../packages/void-fbtee/test/translator/scores.json");
const MODEL = process.env.TRANSLATOR_MODEL;
const CACHE = process.env.TRANSLATOR_FRESH !== "1";
const LANGUAGES = process.env.TRANSLATOR_LANGUAGES?.split(",") ?? Object.keys(REFERENCES);

const readScores = (): Record<string, unknown> =>
  existsSync(SCORES) ? (JSON.parse(readFileSync(SCORES, "utf8")) as Record<string, unknown>) : {};

/** One request to the dev server's translate route (ai.ts devTranslate). */
function route(token: string) {
  return async (body: unknown) => {
    const res = await fetch(`${site}/__void-fbtee/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-void-fbtee-token": token },
      body: JSON.stringify(body),
    });
    if (res.status === 503) return undefined;
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  };
}

interface Result {
  name: string;
  /** right: problems none and judged right, or not yet judged; wrong: problems, or judged wrong. */
  verdict: "right" | "wrong" | "unreviewed";
  problems: string[];
  why?: string;
  attempts: number;
  /** 0 to 100: the meaning score (meaningScores × 100) and the score against the reference. */
  meaning?: number;
  chrF?: number;
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
      const call = route(token);
      const guide = translatingRules(EXAMPLE);
      const refs = REFERENCES[to] ?? {};
      const results: Result[] = [];
      for (const t of STRINGS) {
        const s = t.plural ? { ...t, lines: formsFor(to, t.lines[0]!.text) } : t;
        // The language's other strings, as a catalog's own translations would be: never this one.
        const examples = STRINGS.filter((o) => o.name !== t.name && !o.plural && refs[o.name]).map(
          (o) => ({
            description: o.description,
            source: o.lines[0]!.text,
            translation: refs[o.name]![0]!,
          }),
        );
        const answer = await translateEntry(call, {
          from: "en-US",
          to,
          entry: {
            description: s.description,
            lines: s.lines,
            keep: [...new Set(s.lines.flatMap((l) => keptTerms(l.text)))],
          },
          examples,
          guide,
          model: MODEL,
          cache: CACHE,
        });
        const got = answer?.lines ?? [];
        const problems = answer ? answer.problems : ["no answer: Void's AI isn't available"];
        const ref = refs[t.name];
        const score =
          ref && got.length === ref.length
            ? Math.round(got.reduce((a, l, i) => a + chrF(l, ref[i]!), 0) / got.length)
            : undefined;
        const meaning = got.length
          ? ((await call({ kind: "meaning", pairs: got.map((l, i) => [s.lines[i]!.text, l]) })) as
              | { scores?: number[] }
              | undefined)
          : undefined;
        const m = meaning?.scores?.length
          ? Math.round((100 * meaning.scores.reduce((a, b) => a + b, 0)) / meaning.scores.length)
          : undefined;
        const judged = VERDICTS[to]?.[t.name]?.find((v) => v.answer === got.join("\n"));
        results.push({
          name: t.name,
          verdict: problems.length
            ? "wrong"
            : judged
              ? judged.right
                ? "right"
                : "wrong"
              : "unreviewed",
          problems,
          ...(judged && !judged.right && { why: judged.why }),
          attempts: answer?.attempts ?? 0,
          ...(m !== undefined && { meaning: m }),
          ...(score !== undefined && { chrF: score }),
          got,
        });
      }
      const count = (v: Result["verdict"]) => results.filter((r) => r.verdict === v).length;
      const mean = (k: "meaning" | "chrF") => {
        const xs = results.flatMap((r) => (r[k] === undefined ? [] : [r[k]!]));
        return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined;
      };
      const unreviewed = results
        .filter((r) => r.verdict === "unreviewed")
        .sort((a, b) => (a.meaning ?? 0) + (a.chrF ?? 0) - ((b.meaning ?? 0) + (b.chrF ?? 0)))
        .map((r) => r.name);
      for (const r of results)
        console.log(
          `${to} ${r.verdict === "wrong" ? "✗" : r.verdict === "right" ? "✓" : "?"} ${r.name} (meaning ${r.meaning ?? "-"}, chrF ${r.chrF ?? "-"}): ${r.got.join(" | ")}`,
        );
      const scores = readScores();
      scores[MODEL ? `${to} ${MODEL}` : to] = {
        date: new Date().toISOString().slice(0, 10),
        model: MODEL ?? modelFor(to).id,
        cache: CACHE ? "on" : "off",
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
          Object.fromEntries(Object.entries(scores).sort(([a], [b]) => a.localeCompare(b))),
          null,
          2,
        ) + "\n",
      );
      expect(
        results
          .filter((r) => r.verdict === "wrong")
          .map((r) => `${r.name}: ${r.why ?? r.problems.join(" ")}`),
        `${to}: wrong answers`,
      ).toEqual([]);
    },
  );
}
