// `vp run measure:translator`, with the example's `vp dev` running: how well Void's AI translates
// the app's strings, measured on strings the example already has translated (by Claude Code,
// checked by hand). Each is sent through the dev server's own translate route (void-fbtee's ai.ts),
// the way `vp dev` sends a new one, with each model and each way of sending, and scored:
// - checks: the share of answers that pass the checks `vp dev` applies before it writes one
//   (placeholders, kept words, nothing left in English: translate.ts keepsPlaceholders);
// - chrF: character n-gram F-score (n 1 to 6, beta 2, spaces ignored) against the stored
//   translation, 0 to 100, the measure the example's queue model was chosen by (2026-11-13).
// Plain: what vp dev first sent (no examples, no kept words). Fed: the catalog's closest own
// translations as examples, and each entry's words to keep. Skill: fed, plus what Claude Code
// works from: the translating rules of fbtee's and void-fbtee's skills, and the code around each
// string. WAYS picks some (default all three).
// LOCALES picks languages (default every one). The results go to .vitest/translator.json (git
// ignores it).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collect, catalogFile } from "../packages/void-fbtee/src/catalogs";
import { loadProject } from "../packages/void-fbtee/src/commands";
import { chrF } from "../packages/void-fbtee/test/translator/score";
import {
  examplesFor,
  keepsPlaceholders,
  keptTerms,
  sourceContext,
  translatingRules,
} from "../packages/void-fbtee/src/translate";

const APP = join(import.meta.dirname, "../apps/example");
const URL = process.env.DEV_URL ?? "http://localhost:5173/__void-fbtee/translate";
const MODELS = (process.argv[2] ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast").split(",");
const PER_LOCALE = Number(process.env.SAMPLE ?? 12);
const WAYS = (process.env.WAYS ?? "plain,fed,skill").split(",");

type Line = { translation: string; variations: Record<string, number> };
type Entry = { description?: string; status?: string; translations?: Line[]; source?: string };

const p = await loadProject(APP);
const { texts, builtinHashes } = collect(p);
const token = readFileSync(join(APP, "node_modules/.void-fbtee/dev-token"), "utf8").trim();
const from = p.config.sourceLocale;
const results: Record<string, unknown>[] = [];
const guide = translatingRules(APP);

const only = process.env.LOCALES?.split(",");
for (const locale of p.config.locales
  .map((l) => l.locale)
  .filter((l) => l !== from && (!only || only.includes(l)))) {
  const catalog = JSON.parse(readFileSync(catalogFile(p, locale), "utf8")) as {
    translations: Record<string, Entry>;
  };
  const all = Object.entries(catalog.translations)
    .filter(([h, e]) => e.status === "translated" && texts[h] && !builtinHashes.has(h))
    .map(([h, e]) => ({ hash: h, ...e, source: texts[h] }))
    .sort((a, b) => a.hash.localeCompare(b.hash));
  // An even spread across the catalog, the same every run; examples come from the rest.
  const step = Math.max(1, Math.floor(all.length / PER_LOCALE));
  const held = all.filter((_, i) => i % step === 0).slice(0, PER_LOCALE);
  const rest = all.filter((e) => !held.includes(e));

  for (const model of MODELS) {
    for (const way of WAYS) {
      const fed = way !== "plain";
      let pass = 0,
        score = 0,
        n = 0,
        failed = 0;
      const samples: unknown[] = [];
      for (const e of held) {
        // The source lines as prepare writes a new entry's: the source text on every line.
        const source: Line[] = e.translations!.map((l) => ({ ...l, translation: e.source! }));
        const entry = {
          description: e.description ?? "",
          lines: source.map((l) => ({ text: l.translation, variations: l.variations })),
          ...(fed ? { keep: [...new Set(keptTerms(e.source!))] } : {}),
          ...(way === "skill" ? { context: sourceContext(p, e.hash) } : {}),
        };
        const res = await fetch(URL, {
          method: "POST",
          headers: { "content-type": "application/json", "x-void-fbtee-token": token },
          body: JSON.stringify({
            kind: "strings",
            from,
            to: locale,
            model,
            entries: [entry],
            examples: fed ? examplesFor(rest, [entry]) : [],
            ...(way === "skill" ? { guide } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { lines?: string[][]; error?: string };
        const out = body.lines?.[0] ?? [];
        if (!res.ok || !out.length) {
          failed++;
          continue;
        }
        n++;
        if (keepsPlaceholders(source, out)) pass++;
        const s =
          out.reduce((a, l, i) => a + chrF(l, e.translations![i]!.translation), 0) / out.length;
        score += s;
        samples.push({
          source: e.source,
          stored: e.translations![0]!.translation,
          got: out[0],
          chrF: Math.round(s),
        });
      }
      const row = {
        locale,
        model,
        way,
        answered: `${n}/${held.length}`,
        checks: n ? Math.round((100 * pass) / n) : 0,
        chrF: n ? Math.round((10 * score) / n) / 10 : 0,
        failed,
      };
      console.log(JSON.stringify(row));
      results.push({ ...row, samples });
    }
  }
}
mkdirSync(join(import.meta.dirname, "../.vitest"), { recursive: true });
writeFileSync(
  join(import.meta.dirname, "../.vitest/translator.json"),
  JSON.stringify(results, null, 2),
);
