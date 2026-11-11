// What the "Try it" page shows for a number and some text: the same on the Worker (the
// API route) and in the browser.
export function tryIt(locale: string, value: number, text: string) {
  const n = (options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, options).format(value);
  const words = [...new Intl.Segmenter(locale, { granularity: "word" }).segment(text)];
  return {
    value,
    formats: Number.isNaN(value)
      ? {}
      : {
          default: n(),
          currency: n({ style: "currency", currency: "THB" }),
          compact: n({ notation: "compact", compactDisplay: "long" }),
          percent: n({ style: "percent" }),
          scientific: n({ notation: "scientific" }),
          plural: new Intl.PluralRules(locale).select(value),
          ordinal: new Intl.PluralRules(locale, { type: "ordinal" }).select(value),
        },
    characters: [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)].length,
    words: words.filter((w) => w.isWordLike).map((w) => w.segment),
  };
}
