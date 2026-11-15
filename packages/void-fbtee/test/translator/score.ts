// chrF: character n-gram F-score (n 1 to 6, beta 2, spaces ignored), 0 to 100, of a translation
// against a reference one: how the translators are scored (e2e/translator/, scripts/translator.ts),
// as the example's queue model was chosen (2026-11-13).
export function chrF(hyp: string, ref: string): number {
  const grams = (t: string, n: number) => {
    const s = t.replace(/\s+/g, "");
    const m = new Map<string, number>();
    for (let i = 0; i + n <= s.length; i++)
      m.set(s.slice(i, i + n), (m.get(s.slice(i, i + n)) ?? 0) + 1);
    return m;
  };
  let p = 0,
    r = 0,
    k = 0;
  for (let n = 1; n <= 6; n++) {
    const h = grams(hyp, n),
      g = grams(ref, n);
    const total = (x: Map<string, number>) => [...x.values()].reduce((a, b) => a + b, 0);
    if (!total(h) || !total(g)) continue;
    let match = 0;
    for (const [x, c] of h) match += Math.min(c, g.get(x) ?? 0);
    p += match / total(h);
    r += match / total(g);
    k++;
  }
  if (!k) return 0;
  p /= k;
  r /= k;
  return p + r ? (100 * 5 * p * r) / (4 * p + r) : 0;
}
