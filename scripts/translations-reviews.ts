// `vp run translations:reviews`: how the machine translations fared in Claude's reviews
// (plans/translation-rework.md, step 7), from the review each catalog entry keeps (translate.ts
// Review): per language and translator, how many were reviewed, how many were right, and what was
// wrong. So a change to the prompt, the checks or the skill has its before and after.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Entry = {
  status?: string;
  translatedBy?: string;
  review?: { verdict: "ok" | "wrong"; of?: string; note?: string; at: string };
};
const dir = resolve(import.meta.dirname, "../apps/example/i18n/translations");
const rows: string[][] = [["language", "translator", "translated", "reviewed", "right", "waiting"]];
const notes: string[] = [];
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const locale = file.slice(0, -".json".length);
  const entries = Object.values(
    JSON.parse(readFileSync(join(dir, file), "utf8")).translations as Record<string, Entry>,
  );
  // The translator an entry is counted for: the one the review judged, else the one that wrote it.
  const by = new Map<string, Entry[]>();
  for (const e of entries) {
    const who = e.review?.of ?? e.translatedBy;
    if (!who || who === "claude" || e.status === "new") continue;
    by.set(who, [...(by.get(who) ?? []), e]);
  }
  for (const [who, list] of by) {
    const reviewed = list.filter((e) => e.review);
    const right = reviewed.filter((e) => e.review!.verdict === "ok");
    rows.push([
      locale,
      who,
      String(list.length),
      String(reviewed.length),
      reviewed.length
        ? `${right.length} (${Math.round((100 * right.length) / reviewed.length)}%)`
        : "-",
      String(list.length - reviewed.length),
    ]);
    for (const e of reviewed)
      if (e.review!.verdict === "wrong") notes.push(`${locale} ${e.review!.at}: ${e.review!.note}`);
  }
}
const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i]!)).join("  "));
if (notes.length)
  console.log(`\nWhat Claude found wrong:\n${notes.map((n) => `- ${n}`).join("\n")}`);
