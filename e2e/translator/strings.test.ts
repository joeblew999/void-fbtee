// The translator test: Void's AI, on the dev server, translating the test app's strings
// (packages/void-fbtee/test/translator/: app/src/strings.tsx, fbtee strings in real code) into every
// language the app has, exactly as `vp dev` does: translateWithVoidAi on the app's own fbtee
// catalogs. Each string is made new on its own, by vp dev's own prepare (catalogs.ts prepared():
// fbtee's prepare-translations and the variant lines), the rest of its catalog staying
// translated, so the examples and glossary are the catalog's own, as in a real app; in memory,
// so every string in every language is sent at once (translate.ts translateCatalog, under
// Workers AI's per-minute limit), and the run takes about as long as its slowest answer. One test
// per string, each waiting for its own answer. The translation the catalog had is the reference.
// Each answer:
// - with problems (judge.ts: wrong script, English left, a placeholder or command changed), or one
//   judged wrong (verdicts.json): wrong; judged right: right;
// - nobody has judged it: unreviewed, for Claude Code to judge into verdicts.json;
// - signals, recorded, never deciding: the meaning score (ai.ts meaningScores) and chrF against the
//   reference (score.ts).
// Everything goes to test/translator/scores.json, committed: the git diff is what changed.
//
// Two runs:
// - `vp run test:translator`: each language with its own model (models.json); a wrong answer
//   fails its string's test.
// - `TRANSLATOR_PICK=1 vp run test:translator`: each language with every model in models.json.
//   Nothing fails on a wrong answer; at the end the model with the most right answers is written
//   into models.json as the language's, unless unreviewed answers could change that: they're
//   listed for Claude Code to judge, and the pick is made on the next run.
// TRANSLATOR_LANGUAGES picks languages (th-TH,ar-EG). TRANSLATOR_MODELS picks models for a pick run,
// which then only reports (models.json is written only when every model ran). TRANSLATOR_RULES=0
// sends no translating skill, to measure it (scored as "<language> <model> no-rules").
// AI Gateway's cache is on, keyed by the request and the string's round: how many of its answers
// were judged wrong (ai.ts ask). An answer is stored the first time it's asked, so a judged one
// comes back the same next run; a string judged wrong is asked fresh.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, inject, test } from "vite-plus/test";
import { catalogFile, collect, prepared } from "../../packages/void-fbtee/src/catalogs";
import { loadProject } from "../../packages/void-fbtee/src/commands";
import { CANDIDATES, modelFor } from "../../packages/void-fbtee/src/models";
import { routeCall, translateCatalog } from "../../packages/void-fbtee/src/translate";
import { chrF } from "../../packages/void-fbtee/test/translator/score";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;
const DATA = join(import.meta.dirname, "../../packages/void-fbtee/test/translator");
const SCORES = join(DATA, "scores.json");
const MODELS = join(import.meta.dirname, "../../packages/void-fbtee/src/models.json");
const PICK = process.env.TRANSLATOR_PICK === "1";
const ONLY = process.env.TRANSLATOR_MODELS?.split(",");
const RULES = process.env.TRANSLATOR_RULES !== "0";
const TODAY = new Date().toISOString().slice(0, 10);

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
  cache: string;
  verdict: "right" | "wrong" | "unreviewed";
  why?: string;
  meaning?: number;
  chrF?: number;
  reference: string[];
  got: string[];
}

const token = () =>
  readFileSync(join(EXAMPLE, "node_modules/.void-fbtee/dev-token"), "utf8").trim();
const url = `${site}/__void-fbtee/translate`;

type Entry = Catalog["translations"][string];

/** Each language's catalog as committed: the references. */
const reference = Object.fromEntries(
  LANGUAGES.map((to) => [to, readFileSync(catalogFile(p, to), "utf8")]),
);

/**
 * Each app string as vp dev's prepare writes it when it's just been written: gone from every
 * catalog, then the dev server's own prepare (fbtee's prepare-translations and void-fbtee's
 * variant lines, catalogs.ts prepared()) writes it back new. Done once for all strings (each entry
 * is prepared on its own), then the catalogs are put back.
 */
function freshEntries(): Record<string, Record<string, Entry>> {
  try {
    for (const to of LANGUAGES) {
      const catalog = JSON.parse(reference[to]!) as Catalog;
      for (const hash of hashes) delete catalog.translations[hash];
      writeFileSync(catalogFile(p, to), JSON.stringify(catalog, null, 2) + "\n");
    }
    return Object.fromEntries(
      prepared(p)
        .filter((x) => LANGUAGES.includes(x.locale))
        .map((x) => [x.locale, (JSON.parse(x.json) as Catalog).translations]),
    );
  } finally {
    for (const to of LANGUAGES) writeFileSync(catalogFile(p, to), reference[to]!);
  }
}

/** One string into one language with one model, as vp dev translates it, judged. */
async function translateOne(
  to: string,
  model: string,
  hash: string,
  fresh: Entry,
): Promise<Result> {
  // The committed catalog with this one string new: what vp dev has when it's just been written.
  const catalog = JSON.parse(reference[to]!) as Catalog;
  const byKey = new Map(
    catalog.translations[hash]!.translations.map((l) => [key(l.variations), l.translation]),
  );
  catalog.translations[hash] = structuredClone(fresh);
  const lines = fresh.translations;
  expect(
    lines.map((l) => key(l.variations)).sort(),
    "prepare gives the string the same lines as its reference",
  ).toEqual([...byKey.keys()].sort());
  const ref = lines.map((l) => byKey.get(key(l.variations))!);
  // The string's round: a new one each time an answer to it is judged wrong (verdicts.json).
  const cache = `round ${VERDICTS[to]?.[hash]?.filter((v) => !v.right).length ?? 0}`;
  const log: string[] = [];
  const say = (l: string) => log.push(l);
  const ran = await translateCatalog(p, routeCall(url, token(), say), to, catalog, say, {
    rules: RULES,
    cache,
    model,
  });
  expect(ran, `Void's AI isn't available: ${log.join(" ")}`).toBeDefined();
  const after = catalog.translations[hash]!;
  const kept = after.status === "translated";
  const got = kept ? after.translations.map((l) => l.translation) : [];
  const score =
    got.length === ref.length
      ? Math.round(got.reduce((a, l, i) => a + chrF(l, ref[i]!), 0) / got.length)
      : undefined;
  const res = got.length
    ? await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-void-fbtee-token": token() },
        body: JSON.stringify({ kind: "meaning", pairs: got.map((l) => [texts[hash]!, l]) }),
      })
    : undefined;
  const scores = ((await res?.json()) as { scores?: number[] } | undefined)?.scores ?? [];
  const meaning = scores.length
    ? Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length)
    : undefined;
  const judged = VERDICTS[to]?.[hash]?.find((v) => v.answer === got.join("\n"));
  return {
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
  };
}

/** A line's variations as one comparable key ({"0": 2, "1": 20} → "0:2,1:20"). */
const key = (v: Record<string, number> | undefined) =>
  Object.entries(v ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, x]) => `${k}:${x}`)
    .join(",");

const count = (rs: Result[], v: Result["verdict"]) => rs.filter((r) => r.verdict === v).length;
const mean = (rs: Result[], k: "meaning" | "chrF") => {
  const xs = rs.flatMap((r) => (r[k] === undefined ? [] : [r[k]!]));
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined;
};

function writeScores(to: string, model: string, results: Result[]): void {
  const all = existsSync(SCORES)
    ? (JSON.parse(readFileSync(SCORES, "utf8")) as Record<string, unknown>)
    : {};
  all[(PICK ? `${to} ${model}` : to) + (RULES ? "" : " no-rules")] = {
    date: TODAY,
    model,
    right: count(results, "right"),
    wrong: count(results, "wrong"),
    unreviewed: results.filter((r) => r.verdict === "unreviewed").map((r) => r.text),
    meaning: mean(results, "meaning"),
    chrF: mean(results, "chrF"),
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
}

/** The pick run's end: the model with the most right answers becomes the language's. */
function pick(to: string, byModel: Map<string, Result[]>, strings: number): void {
  const unreviewed = [...byModel].flatMap(([m, rs]) =>
    rs
      .filter((r) => r.verdict === "unreviewed")
      .map((r) => `${m}: ${r.text} → ${r.got.join(" | ")}`),
  );
  const tally = [...byModel]
    .map(([model, rs]) => ({ model, right: count(rs, "right"), chrF: mean(rs, "chrF") ?? 0 }))
    .sort((a, b) => b.right - a.right || b.chrF - a.chrF);
  console.log(`${to}: ${tally.map((t) => `${t.model} ${t.right}/${strings}`).join(", ")}`);
  const best = tally[0]!;
  // Unjudged answers matter only where they could change the pick: another model whose right
  // answers plus its unjudged ones reach the leader's.
  const open = (m: string) => count(byModel.get(m)!, "unreviewed");
  const contested = tally.slice(1).some((t) => t.right + open(t.model) >= best.right);
  if (contested || open(best.model))
    throw new Error(
      `${to}: ${unreviewed.length} answers to judge in verdicts.json, then run again:\n${unreviewed.join("\n")}`,
    );
  if (unreviewed.length)
    console.log(`${to}: ${unreviewed.length} unjudged answers that can't change the pick`);
  // Only some models, or without the skill: a measurement, not a pick.
  if (ONLY || !RULES) return;
  const data = JSON.parse(readFileSync(MODELS, "utf8")) as {
    languages: { language: string; name: string; model: string; source: string; why: string }[];
  };
  const language = new Intl.Locale(to).language;
  const entry = {
    language,
    name: new Intl.DisplayNames("en", { type: "language" }).of(language)!,
    model: best.model,
    source: "measured",
    why: `${best.right}/${strings} right, the translator test's pick run (${TODAY}); then ${tally
      .slice(1)
      .map((t) => `${t.model.split("/").pop()} ${t.right}`)
      .join(", ")}`,
  };
  const i = data.languages.findIndex((c) => c.language === language);
  if (i >= 0) data.languages[i] = { ...data.languages[i]!, ...entry };
  else data.languages.push(entry);
  writeFileSync(MODELS, JSON.stringify(data, null, 2) + "\n");
}

const hashes = Object.keys(
  (JSON.parse(readFileSync(catalogFile(p, LANGUAGES[0]!), "utf8")) as Catalog).translations,
).filter((h) => !builtinHashes.has(h));

const models = (to: string) =>
  PICK ? CANDIDATES.map((m) => m.id).filter((m) => !ONLY || ONLY.includes(m)) : [modelFor(to).id];

// Every string in every language with every model, sent at once before the first test: each
// test then waits only for its own answer.
const started = new Map<string, Promise<Result>>();
const job = (to: string, model: string, hash: string) => `${to} ${model} ${hash}`;
beforeAll(() => {
  if (skip) return;
  const fresh = freshEntries();
  for (const to of LANGUAGES)
    for (const model of models(to))
      for (const hash of hashes) {
        const run = translateOne(to, model, hash, fresh[to]![hash]!);
        // Its failure is its own test's, when that test awaits it.
        run.catch(() => {});
        started.set(job(to, model, hash), run);
      }
});

describe("languages", () => {
  for (const to of LANGUAGES) {
    describe(to, () => {
      const byModel = new Map<string, Result[]>();
      for (const model of models(to)) {
        describe(model, () => {
          const results: Result[] = [];
          byModel.set(model, results);
          for (const hash of hashes)
            test.skipIf(!!skip)(texts[hash]!, async () => {
              const r = await started.get(job(to, model, hash))!;
              results.push(r);
              const mark = r.verdict === "wrong" ? "✗" : r.verdict === "right" ? "✓" : "?";
              console.log(
                `${to} ${model.split("/").pop()} ${mark} ${r.text} (meaning ${r.meaning ?? "-"}, chrF ${r.chrF ?? "-"}): ${r.got.join(" | ")}${r.why ? ` — ${r.why}` : ""}`,
              );
              if (!PICK) expect(r.verdict, `${to}: ${r.text}: ${r.why}`).not.toBe("wrong");
            });
          afterAll(() => writeScores(to, model, results));
        });
      }
      if (PICK) afterAll(() => pick(to, byModel, hashes.length));
    });
  }
});
