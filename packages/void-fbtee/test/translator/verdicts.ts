// What a person decided about the translator test's answers (e2e/translator/), by language and
// string name: each answer they read, right or wrong, and why when wrong. The test applies them
// every run: an answer marked wrong fails each time it comes back, one marked right passes, and
// one nobody has read is listed as unreviewed (scores.json). At temperature 0 the same request gets
// the same answer, so a verdict keeps applying until something changes the request.
// Each answer is its lines joined by "\n". Written by Claude Code until native speakers review.
export interface Verdict {
  answer: string;
  right: boolean;
  /** Why it's wrong, in words a translator can act on. */
  why?: string;
  /** Who decided, and when: "Claude Code, 2026-11-15". */
  by: string;
}

export const VERDICTS: Record<string, Record<string, Verdict[]>> = {};
