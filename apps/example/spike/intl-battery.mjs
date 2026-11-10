// SPIKE: the same Intl calls, run in workerd (routes/api/intl.ts) and in Chrome.
// Fixed instant and explicit time zones, so the only variable is the ICU build.
export function battery() {
  const at = new Date(Date.UTC(2026, 10, 10, 13, 5, 9));
  const locs = [
    "en-US",
    "th-TH",
    "th-TH-u-ca-buddhist-nu-thai",
    "ar-EG",
    "de-DE",
    "pl-PL",
    "ja-JP",
    "he-IL",
    "hi-IN",
  ];
  const out = {};
  const safe = (f) => {
    try {
      return f();
    } catch (e) {
      return "ERR " + e.message;
    }
  };
  for (const l of locs) {
    out[l] = {
      date: safe(() =>
        new Intl.DateTimeFormat(l, {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: "Asia/Bangkok",
        }).format(at),
      ),
      dateNY: safe(() =>
        new Intl.DateTimeFormat(l, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/New_York",
        }).format(at),
      ),
      range: safe(() =>
        new Intl.DateTimeFormat(l, { dateStyle: "medium", timeZone: "UTC" }).formatRange(
          at,
          new Date(at.getTime() + 3 * 864e5),
        ),
      ),
      hourCycle: safe(
        () => new Intl.DateTimeFormat(l, { hour: "numeric" }).resolvedOptions().hourCycle,
      ),
      calendar: safe(() => new Intl.DateTimeFormat(l).resolvedOptions().calendar),
      num: safe(() => new Intl.NumberFormat(l).format(1234567.891)),
      numSys: safe(() => new Intl.NumberFormat(l).resolvedOptions().numberingSystem),
      thb: safe(() =>
        new Intl.NumberFormat(l, { style: "currency", currency: "THB" }).format(1234.5),
      ),
      eur: safe(() =>
        new Intl.NumberFormat(l, {
          style: "currency",
          currency: "EUR",
          currencyDisplay: "name",
        }).format(2),
      ),
      unit: safe(() =>
        new Intl.NumberFormat(l, {
          style: "unit",
          unit: "kilometer-per-hour",
          unitDisplay: "long",
        }).format(88),
      ),
      temp: safe(() => new Intl.NumberFormat(l, { style: "unit", unit: "fahrenheit" }).format(72)),
      compact: safe(() => new Intl.NumberFormat(l, { notation: "compact" }).format(1520000)),
      pct: safe(() =>
        new Intl.NumberFormat(l, { style: "percent", maximumFractionDigits: 1 }).format(0.256),
      ),
      plural: safe(() =>
        [0, 1, 2, 3, 5, 11, 22, 101].map((n) => new Intl.PluralRules(l).select(n)).join(","),
      ),
      ordinal: safe(() =>
        [1, 2, 3, 4, 11, 21]
          .map((n) => new Intl.PluralRules(l, { type: "ordinal" }).select(n))
          .join(","),
      ),
      rel: safe(
        () =>
          new Intl.RelativeTimeFormat(l, { numeric: "auto" }).format(-1, "day") +
          " | " +
          new Intl.RelativeTimeFormat(l).format(3, "hour"),
      ),
      list: safe(() =>
        new Intl.ListFormat(l, { type: "conjunction" }).format(["Bangkok", "Berlin", "Cairo"]),
      ),
      region: safe(() => new Intl.DisplayNames([l], { type: "region" }).of("TH")),
      lang: safe(() => new Intl.DisplayNames([l], { type: "language" }).of("de-DE")),
      currencyName: safe(() => new Intl.DisplayNames([l], { type: "currency" }).of("JPY")),
      sort: safe(() =>
        ["ä", "a", "z", "ข", "ก", "ö", "o"].sort(new Intl.Collator(l).compare).join(""),
      ),
      dur: safe(() =>
        typeof Intl.DurationFormat === "function"
          ? new Intl.DurationFormat(l, { style: "long" }).format({ hours: 2, minutes: 5 })
          : "missing",
      ),
    };
  }
  out.segmentThai = safe(() =>
    [...new Intl.Segmenter("th", { granularity: "word" }).segment("สวัสดีชาวโลก")]
      .map((s) => s.segment)
      .join("|"),
  );
  out.segmentJa = safe(() =>
    [...new Intl.Segmenter("ja", { granularity: "word" }).segment("東京都に住んでいます")]
      .map((s) => s.segment)
      .join("|"),
  );
  out.supported = safe(() =>
    ["calendar", "collation", "currency", "numberingSystem", "timeZone", "unit"]
      .map((k) => k + ":" + Intl.supportedValuesOf(k).length)
      .join(" "),
  );
  out.defaultTZ = safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  out.defaultLocale = safe(() => Intl.DateTimeFormat().resolvedOptions().locale);
  return out;
}
