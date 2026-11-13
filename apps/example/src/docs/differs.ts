// What the reference pages (Intl, Temporal) use to show where two results differ.

/** A differing row: a strong tint and a bar down its first cell, with no fade-in, on any screen. */
export const DIFFERS_ROW =
  "bg-brand/25 transition-none hover:bg-brand/25 [&>td:first-child]:border-s-4 [&>td:first-child]:border-brand";

/** Characters that print as nothing (or as a plain space), by the name they're shown as. */
const INVISIBLE: Record<string, string> = {
  "‎": "LRM",
  "‏": "RLM",
  "؜": "ALM",
  "​": "ZWSP",
  " ": "NBSP",
  " ": "NNBSP",
  "⁦": "LRI",
  "⁧": "RLI",
  "⁨": "FSI",
  "⁩": "PDI",
};
const INVISIBLE_RE = new RegExp(`[${Object.keys(INVISIBLE).join("")}]`, "gu");

/** The text with each invisible character shown by name, ⟨RLM⟩: for a row that differs. */
export const showInvisible = (text: string) =>
  text.replace(INVISIBLE_RE, (c) => `⟨${INVISIBLE[c]}⟩`);

/** A supported-values row's list ("3: a, b, c"), as its values. */
export const listOf = (row: string) =>
  row
    .replace(/^\d+: /, "")
    .split(", ")
    .filter(Boolean);

/** What's in one list and not the other. */
export function listDifference(worker: string, browser: string) {
  const w = new Set(listOf(worker));
  const b = new Set(listOf(browser));
  return {
    onlyWorker: [...w].filter((v) => !b.has(v)),
    onlyBrowser: [...b].filter((v) => !w.has(v)),
  };
}
