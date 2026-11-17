// `vp run translations:measure`: how well each translator does on a sample of the example's strings,
// before void-fbtee changes translator (plans/translation-rework.md, step 2). Needs `vp run dev`
// running on this machine with Void signed in to Cloudflare (`vp run login`): every request goes
// through the dev server's own translate route, so it runs exactly as `vp dev` translates.
//
// For each language below, the same sample (up to SAMPLE entries, counts and genders first) goes to:
// - today's translator: the language's Workers AI model (models.json), one entry per request, with
//   examples, glossary and up to 3 tries (translate.ts translateEntry), as `vp dev` does now;
// - Gemini 3.5 Flash (ai.ts GEMINI), wuchale's way: the whole sample in one request, then once more
//   for only those that failed.
// Each answer is checked by judge.ts problemsWith(). Gemini is paid from the account's AI Gateway
// credits, so its cost is added up from each answer's tokens and the run stops at CAP_USD.
// Results go to plans/translation-rework-measure.json, beside the catalog's current translation,
// for Claude to review.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFile, collect, freshCatalog } from "../packages/void-fbtee/src/catalogs";
import { loadProject } from "../packages/void-fbtee/src/commands";
import { keptTerms, problemsWith } from "../packages/void-fbtee/src/judge";
import { GEMINI, modelFor, type Usage } from "../packages/void-fbtee/src/models";
import { DEV_TRANSLATE_PATH } from "../packages/void-fbtee/src/plugin";
import {
  examplesFor,
  fbteeRules,
  glossaryFor,
  sourceContext,
  translateEntry,
} from "../packages/void-fbtee/src/translate";

const LOCALES = process.argv.includes("--probe") ? ["th-TH"] : ["ar-EG", "th-TH"];
/** `--probe`: one string, to prove a model answers before a whole sample is paid for. */
const SAMPLE = process.argv.includes("--probe") ? 1 : 25;
/** `--gemini-only`: skip today's translator (its Workers AI allowance may be used up). */
const GEMINI_ONLY = process.argv.includes("--gemini-only") || process.argv.includes("--probe");
/** The most this run may spend on Gemini, in US$ (plans/translation-rework.md, "Spending"). */
const CAP_USD = 0.5;

const repo = resolve(import.meta.dirname, "..");
const app = join(repo, "apps/example");
const p = await loadProject(app);
const url = new URL(DEV_TRANSLATE_PATH, process.env.DEV_URL ?? "http://localhost:5173").href;
let token: string;
try {
  token = readFileSync(join(app, "node_modules/.void-fbtee/dev-token"), "utf8").trim();
} catch {
  throw new Error(
    "No dev server token: start `vp run dev` first, then run this in another terminal.",
  );
}

type Answer = { lines?: string[][]; model?: string; usage?: Usage[]; error?: string };
let spent = 0;
const tokens = new Map<string, { input: number; output: number; requests: number }>();

/** One request to the dev server's translate route, its tokens counted against its model. */
async function call(input: unknown): Promise<(Answer & Record<string, unknown>) | undefined> {
  const body = input as Record<string, unknown>;
  if (body.model === GEMINI.id && spent >= CAP_USD) return undefined;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-void-fbtee-token": token },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      `No dev server at ${url}: start \`vp run dev\` first, then run this in another terminal.`,
    );
  });
  const answer = (await res.json().catch(() => ({}))) as Answer & Record<string, unknown>;
  if (!res.ok) {
    console.log(`  ${res.status}: ${answer.error ?? "no answer"}`);
    if (res.status === 503)
      throw new Error("Void's AI isn't available: is Void signed in (`vp run login`)?");
  }
  const t = tokens.get(answer.model!) ?? { input: 0, output: 0, requests: 0 };
  for (const u of answer.usage ?? []) {
    t.input += u.prompt_tokens ?? 0;
    t.output += u.completion_tokens ?? 0;
  }
  t.requests++;
  if (answer.model) tokens.set(answer.model, t);
  if (answer.model === GEMINI.id)
    spent =
      (tokens.get(GEMINI.id)!.input * GEMINI.price.input +
        tokens.get(GEMINI.id)!.output * GEMINI.price.output) /
      1e6;
  // A failed request still costs what it used; its answer is empty.
  return res.ok ? answer : {};
}

const { texts, builtinHashes } = collect(p);
const fbtee = fbteeRules(p.root);
const from = p.config.sourceLocale;
const results: Record<string, unknown>[] = [];

for (const locale of LOCALES) {
  // The source lines, one per plural form and gender, as a new catalog would have them.
  const source = JSON.parse(freshCatalog(p, locale)).translations as Record<
    string,
    {
      description?: string;
      translations: { translation: string; variations: Record<string, number> }[];
    }
  >;
  const catalog = JSON.parse(readFileSync(catalogFile(p, locale), "utf8")).translations as Record<
    string,
    { status?: string; translations?: { translation: string }[] }
  >;
  const usable = Object.keys(source)
    .filter((h) => !builtinHashes.has(h) && texts[h] && catalog[h]?.translations?.length)
    .sort();
  const variants = usable.filter((h) => source[h]!.translations.length > 1);
  const sample = [...variants.slice(0, 8), ...usable.filter((h) => !variants.includes(h))].slice(
    0,
    SAMPLE,
  );
  const entries = sample.map((h) => ({
    hash: h,
    description: source[h]!.description ?? "",
    lines: source[h]!.translations.map((l) => ({ text: l.translation, variations: l.variations })),
    keep: [...new Set(source[h]!.translations.flatMap((l) => keptTerms(l.translation)))],
    context: sourceContext(p, h),
  }));
  const finished = Object.entries(catalog)
    .filter(([h]) => !builtinHashes.has(h) && !sample.includes(h))
    .map(([h, e]) => ({ ...e, source: texts[h] })) as Parameters<typeof examplesFor>[0];
  /** What a translator is sent: the entry without our hash. */
  const payload = (e: (typeof entries)[number]) => ({
    description: e.description,
    lines: e.lines,
    keep: e.keep,
    context: e.context,
  });
  const record = (model: string, e: (typeof entries)[number], lines: string[], extra = {}) =>
    results.push({
      locale,
      model,
      hash: e.hash,
      description: e.description,
      source: e.lines.map((l) => l.text),
      current: catalog[e.hash]!.translations!.map((l) => l.translation),
      answer: lines,
      problems: problemsWith(
        e.lines.map((l) => ({ translation: l.text, variations: l.variations })),
        lines,
        locale,
        from,
      ),
      ...extra,
    });

  // Today's translator.
  const today = modelFor(locale).id;
  if (!GEMINI_ONLY) {
    console.log(`\n${locale}: ${entries.length} entries with ${today}, one at a time`);
    const started = Date.now();
    for (const e of entries) {
      const entry = payload(e);
      const answer = await translateEntry(call, {
        from,
        to: locale,
        entry,
        examples: examplesFor(finished, [entry]),
        glossary: glossaryFor(finished, [entry], Object.keys(p.common ?? {})),
        fbtee,
      });
      record(today, e, answer?.lines ?? [], { attempts: answer?.attempts });
    }
    console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }

  // Gemini, wuchale's way.
  console.log(`${locale}: the same ${entries.length} with ${GEMINI.id}, all in one request`);
  const started2 = Date.now();
  let open = entries;
  for (let round = 1; round <= 2 && open.length; round++) {
    const answer = await call({
      kind: "strings",
      from,
      to: locale,
      entries: open.map(payload),
      fbtee,
      model: GEMINI.id,
    });
    if (!answer) {
      console.log(`  stopped: US$${spent.toFixed(3)} spent, the cap is US$${CAP_USD}`);
      break;
    }
    const failed: typeof entries = [];
    open.forEach((e, i) => {
      const lines = answer.lines?.[i] ?? [];
      const source = e.lines.map((l) => ({ translation: l.text, variations: l.variations }));
      if (problemsWith(source, lines, locale, from).length && round === 1) failed.push(e);
      else record(GEMINI.id, e, lines, { attempts: round });
    });
    open = failed;
  }
  console.log(
    `  ${((Date.now() - started2) / 1000).toFixed(0)} s, US$${spent.toFixed(4)} spent so far`,
  );
}

// What each model got: entries with no problems, tokens, and Gemini's cost.
const summary = LOCALES.flatMap((locale) =>
  [...new Set(results.filter((r) => r.locale === locale).map((r) => r.model as string))].map(
    (model) => {
      const mine = results.filter((r) => r.locale === locale && r.model === model);
      return {
        locale,
        model,
        entries: mine.length,
        passed: mine.filter((r) => !(r.problems as string[]).length).length,
      };
    },
  ),
);
console.log("\nPassed the checks:");
for (const s of summary) console.log(`  ${s.locale} ${s.model}: ${s.passed} of ${s.entries}`);
console.log("Tokens:");
for (const [model, t] of tokens)
  console.log(`  ${model}: ${t.requests} requests, ${t.input} in, ${t.output} out`);
console.log(`Gemini cost: US$${spent.toFixed(4)} (cap US$${CAP_USD})`);

const out = join(repo, "plans/translation-rework-measure.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      $comment:
        "plans/translation-rework.md step 2: each translator on the same sample, checked by judge.ts problemsWith(); `current` is the catalog's translation at the time, for Claude's review. Made by `vp run translations:measure`.",
      date: new Date().toISOString(),
      summary,
      tokens: Object.fromEntries(tokens),
      geminiUsd: spent,
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nWritten: ${out.slice(repo.length + 1)}`);
