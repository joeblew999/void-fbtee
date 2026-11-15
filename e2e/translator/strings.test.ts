// Void's AI, on the dev server, translating the package's English test strings
// (packages/void-fbtee/test/translator/strings.ts) into many languages, as `vp dev` translates a
// new string: through the dev server's own route (void-fbtee's ai.ts), with each language's model
// (models.ts). Each answer must pass the checks `vp dev` applies before it writes one
// (translate.ts problemsWith): one line per form, nothing left in English, placeholders,
// commands, file names and paths kept. `vp run test:translator` (the dev server's setup: yours if
// it's running, else it starts one); TRANSLATOR_LANGUAGES picks the languages (default below).
//
// Where a string has a reference translation for the language (strings.ts `ref`), the answer is
// scored against it (chrF, score.ts); without one, the checks catch what breaks an app, but not
// wording. Each language's result goes to packages/void-fbtee/test/translator/scores.json,
// committed: what passes and fails, every answer, the model and the date, so each cycle starts
// from what's failing and git shows whether a change helped. Every answer is printed too.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import {
  keptTerms,
  translateEntry,
  translatingRules,
} from "../../packages/void-fbtee/src/translate";
import { modelFor } from "../../packages/void-fbtee/src/models";
import { chrF } from "../../packages/void-fbtee/test/translator/score";
import { formsFor, STRINGS } from "../../packages/void-fbtee/test/translator/strings";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;
const SCORES = join(import.meta.dirname, "../../packages/void-fbtee/test/translator/scores.json");
type Scores = Record<string, unknown>;
const readScores = (): Scores =>
  existsSync(SCORES) ? (JSON.parse(readFileSync(SCORES, "utf8")) as Scores) : {};
const LANGUAGES = (
  process.env.TRANSLATOR_LANGUAGES ??
  "th-TH,ar-EG,vi-VN,id-ID,ja-JP,zh-CN,ko-KR,hi-IN,de-DE,fr-FR,es-ES,ru-RU"
).split(",");

for (const to of LANGUAGES) {
  test.skipIf(!!skip)(
    `Void's AI translates the test strings into ${to} (${modelFor(to).id})`,
    async () => {
      const guide = translatingRules(EXAMPLE);
      const token = readFileSync(
        join(EXAMPLE, "node_modules/.void-fbtee/dev-token"),
        "utf8",
      ).trim();
      const failures: string[] = [];
      const results: {
        name: string;
        ok: boolean;
        attempts: number;
        problems: string[];
        got: string[];
        chrF?: number;
      }[] = [];
      for (const t of STRINGS) {
        const s = t.plural ? { ...t, lines: formsFor(to, t.lines[0]!.text) } : t;
        // As vp dev sends it, asked again with what was wrong (translate.ts translateEntry), with
        // the skills' rules; no catalog here, so no examples or glossary.
        const call = async (body: unknown) => {
          const res = await fetch(`${site}/__void-fbtee/translate`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-void-fbtee-token": token },
            body: JSON.stringify(body),
          });
          if (res.status === 503) return undefined;
          return (await res.json().catch(() => ({}))) as Record<string, unknown>;
        };
        const answer = await translateEntry(call, {
          from: "en-US",
          to,
          entry: {
            description: s.description,
            lines: s.lines,
            keep: [...new Set(s.lines.flatMap((l) => keptTerms(l.text)))],
          },
          guide,
        });
        const out = answer?.lines ?? [];
        const problems = answer ? answer.problems : ["no answer: Void's AI isn't available"];
        const ref = t.ref?.[to];
        const score =
          ref && out.length === ref.length
            ? Math.round(out.reduce((a, l, i) => a + chrF(l, ref[i]!), 0) / out.length)
            : undefined;
        results.push({
          name: s.name,
          ok: !problems.length,
          attempts: answer?.attempts ?? 0,
          problems,
          got: out,
          ...(score !== undefined && { chrF: score }),
        });
        console.log(
          `${to} ${problems.length ? "✗" : "✓"} ${s.name}${score !== undefined ? ` (chrF ${score})` : ""}: ${out.join(" | ")}`,
        );
        if (problems.length)
          failures.push(`${s.name}: ${problems.join(" ")} (got ${JSON.stringify(out)})`);
      }
      const scored = results.filter((r) => r.chrF !== undefined);
      const scores = readScores();
      scores[to] = {
        date: new Date().toISOString().slice(0, 10),
        model: modelFor(to).id,
        passed: `${results.filter((r) => r.ok).length}/${results.length}`,
        ...(scored.length && {
          chrF: Math.round(scored.reduce((a, r) => a + r.chrF!, 0) / scored.length),
        }),
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
      expect(failures, `${to}: what failed the checks`).toEqual([]);
    },
  );
}
