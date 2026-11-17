// `vp run translations:measure`: the translator on a sample of the example's strings, through exactly
// the code `vp dev` uses (translate.ts translateCatalog: batches, checks, retries), so a change to
// the prompt, the checks or the skill can be measured before it's used on whole catalogs
// (plans/translation-rework.md). Needs `vp run dev` running on this machine with Void signed in to
// Cloudflare.
//
// For each language below, up to SAMPLE entries (counts and genders first) are taken from its
// catalog, set back to new, and translated again. Nothing is written to the catalogs: the answers
// go to plans/translation-rework-measure.json beside the catalog's own translation, for Claude to
// review. `--probe` sends one string in one language, to prove the translator answers before a
// sample is paid for. Gemini is paid from the account's AI Gateway credits: each run prints what
// it cost.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFile, collect, freshCatalog } from "../packages/void-fbtee/src/catalogs";
import { loadProject } from "../packages/void-fbtee/src/commands";
import { problemsWith } from "../packages/void-fbtee/src/judge";
import { GEMINI } from "../packages/void-fbtee/src/models";
import { DEV_TRANSLATE_PATH } from "../packages/void-fbtee/src/plugin";
import { routeCall, translateCatalog } from "../packages/void-fbtee/src/translate";

const probe = process.argv.includes("--probe");
const LOCALES = probe ? ["th-TH"] : ["ar-EG", "th-TH"];
const SAMPLE = probe ? 1 : 25;

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
const route = routeCall(url, token, (line) => console.log(`  ${line}`));
const call: typeof route = (body) =>
  route(body).catch(() => {
    throw new Error(`No dev server at ${url}: start \`vp run dev\` first.`);
  });

type Line = { translation: string; variations: Record<string, number> };
type Entry = { description?: string; status?: string; translations: Line[] };
const { texts, builtinHashes } = collect(p);
const from = p.config.sourceLocale;
const results: Record<string, unknown>[] = [];
const summary: Record<string, unknown>[] = [];
let usd = 0;

for (const locale of LOCALES) {
  // The source lines, one per plural form and gender, as a new catalog would have them.
  const source = JSON.parse(freshCatalog(p, locale)).translations as Record<string, Entry>;
  const current = JSON.parse(readFileSync(catalogFile(p, locale), "utf8")).translations as Record<
    string,
    Entry
  >;
  const usable = Object.keys(source)
    .filter((h) => !builtinHashes.has(h) && texts[h] && current[h]?.translations?.length)
    .sort();
  const variants = usable.filter((h) => source[h]!.translations.length > 1);
  const sample = [...variants.slice(0, 8), ...usable.filter((h) => !variants.includes(h))].slice(
    0,
    SAMPLE,
  );
  // The catalog as it is, with the sample set back to new: the rest is the glossary's source.
  const catalog = {
    translations: Object.fromEntries(
      Object.entries(current).map(([h, e]) => [
        h,
        sample.includes(h) ? { ...source[h]!, status: "new" } : e,
      ]),
    ),
  };
  console.log(`\n${locale}: ${sample.length} entries`);
  const started = Date.now();
  const ran = await translateCatalog(p, call, locale, catalog, (line) => console.log(`  ${line}`));
  if (!ran) throw new Error("Void's AI isn't available: is Void signed in (`vp run login`)?");
  usd += ran.usd;
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`  ${ran.done} of ${ran.open} passed, ${seconds} s, US$${ran.usd.toFixed(4)}`);
  summary.push({ locale, entries: ran.open, passed: ran.done, seconds, usd: ran.usd });
  for (const h of sample) {
    const answer = catalog.translations[h]! as Entry;
    const lines =
      answer.status === "translated" ? answer.translations.map((l) => l.translation) : [];
    results.push({
      locale,
      hash: h,
      description: source[h]!.description,
      source: source[h]!.translations.map((l) => l.translation),
      current: current[h]!.translations.map((l) => l.translation),
      answer: lines,
      problems: lines.length
        ? problemsWith(source[h]!.translations, lines, locale, from)
        : ["not translated"],
    });
  }
}
console.log(`\nCost: US$${usd.toFixed(4)} with ${GEMINI.id}`);

const out = join(repo, "plans/translation-rework-measure.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      $comment:
        "plans/translation-rework.md: the translator on a sample, through translate.ts translateCatalog, checked by judge.ts problemsWith(); `current` is the catalog's translation at the time, for Claude's review. Made by `vp run translations:measure`.",
      date: new Date().toISOString(),
      model: GEMINI.id,
      summary,
      usd,
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Written: ${out.slice(repo.length + 1)}`);
