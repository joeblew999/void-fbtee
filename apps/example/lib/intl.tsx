// Every row of the Intl page: one call to the platform's own Intl (or fbtee), in the page's
// language. The page runs each row in the loader on the Worker, which is the text a void-fbtee
// app's pages show, and again in the browser after hydration, to show where its engine's own
// locale data writes it differently. The same code runs both times.
//
// What it covers follows go-htmx4's /formats page (joeblew999/go-htmx4, views/formats.gsx at
// 7f0afab, 2026-11-07), plus fbtee. Temporal has its own page (lib/temporal.ts). Times are in a
// named zone, so both format the same moment; "in your time zone" is the browser's alone.
import { fbt, list } from "fbtee";

export type SectionId =
  | "dates"
  | "zones"
  | "ranges"
  | "relative"
  | "numbers"
  | "currency"
  | "units"
  | "plurals"
  | "lists"
  | "durations"
  | "names"
  | "collation"
  | "segments"
  | "locale"
  | "supported"
  | "strings";

export interface Row {
  id: string;
  /** The call, as code. */
  code: string;
  run: (locale: string) => string;
}

/** The instant most rows format: 4 July 2026, 15:30:45.123 UTC. */
export const INSTANT = "2026-07-04T15:30:45.123Z";
/** The zone they're shown in, written into each call. */
export const ZONE = "Asia/Bangkok";

const at = (iso: string) => new Date(iso);
// Text as is; a value with its own toString (fbtee's result object: fbt() is typed as a string,
// but in the browser it returns that object) as its text; plain data as JSON.
const show = (v: unknown) =>
  typeof v === "string"
    ? v
    : typeof v === "object" &&
        v !== null &&
        !Array.isArray(v) &&
        v.toString !== Object.prototype.toString
      ? (v as { toString(): string }).toString()
      : JSON.stringify(v);
const js = (v: unknown): string =>
  v instanceof Date
    ? `new Date("${v.toISOString()}")`
    : typeof v === "object" && v !== null && !Array.isArray(v)
      ? `{ ${Object.entries(v)
          .map(([k, x]) => `${/^[a-z]\w*$/i.test(k) ? k : JSON.stringify(k)}: ${js(x)}`)
          .join(", ")} }`
      : JSON.stringify(v);

type Api =
  | "DateTimeFormat"
  | "RelativeTimeFormat"
  | "NumberFormat"
  | "PluralRules"
  | "ListFormat"
  | "DurationFormat"
  | "DisplayNames"
  | "Collator"
  | "Segmenter";

/** `new Intl[api](lang, options)[method](...args)`. */
function call(
  id: string,
  api: Api,
  options: object | undefined,
  method: string,
  ...args: unknown[]
): Row {
  return {
    id,
    code: `new Intl.${api}(lang${options ? `, ${js(options)}` : ""}).${method}(${args.map(js).join(", ")})`,
    run: (locale) => {
      const Ctor = (Intl as unknown as Record<Api, new (l: string, o?: object) => object>)[api];
      const formatter = new Ctor(locale, options) as Record<string, (...a: unknown[]) => unknown>;
      let out = formatter[method]!(...args);
      if (method === "segment")
        out = [...(out as Iterable<{ segment: string; isWordLike?: boolean }>)].map((s) =>
          s.isWordLike === undefined ? s.segment : `${s.segment}${s.isWordLike ? "" : "·"}`,
        );
      if (method === "resolvedOptions")
        out = (out as { pluralCategories: string[] }).pluralCategories;
      return show(out);
    },
  };
}

const dt = (id: string, options: object, method = "format", ...args: unknown[]) =>
  call(
    id,
    "DateTimeFormat",
    { ...options, timeZone: ZONE },
    method,
    ...(args.length ? args : [at(INSTANT)]),
  );
const num = (id: string, options: object | undefined, ...args: unknown[]) =>
  call(id, "NumberFormat", options, "format", ...args);
const custom = (id: string, code: string, run: (locale: string) => unknown): Row => ({
  id,
  code,
  run: (locale) => show(run(locale)),
});

const DURATION = { days: 1, hours: 2, minutes: 5, seconds: 30 };

export const SECTIONS: { id: SectionId; rows: Row[] }[] = [
  {
    id: "dates",
    rows: [
      dt("date-full", { dateStyle: "full" }),
      dt("date-long-short", { dateStyle: "long", timeStyle: "short" }),
      dt("date-medium-medium", { dateStyle: "medium", timeStyle: "medium" }),
      dt("date-short-full", { dateStyle: "short", timeStyle: "full" }),
      dt("weekday", { weekday: "long", month: "long", day: "numeric" }),
      dt("year-month", { year: "numeric", month: "short" }),
      dt("h12", { hour: "numeric", minute: "2-digit", hourCycle: "h12" }),
      dt("h23", { hour: "numeric", minute: "2-digit", hourCycle: "h23" }),
      dt("day-period", { hour: "numeric", dayPeriod: "long" }),
      dt("era", { era: "long", year: "numeric" }),
      dt("fraction", { minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }),
      dt("arab-digits", { dateStyle: "medium", numberingSystem: "arab" }),
      dt("japanese", { dateStyle: "long", calendar: "japanese" }),
      dt("buddhist", { dateStyle: "long", calendar: "buddhist" }),
      dt("islamic", { dateStyle: "long", calendar: "islamic-umalqura" }),
      dt("hebrew", { dateStyle: "long", calendar: "hebrew" }),
    ],
  },
  {
    id: "zones",
    rows: [
      ["Asia/Tokyo", "short"],
      ["America/New_York", "longGeneric"],
      ["America/Los_Angeles", "shortGeneric"],
      ["Asia/Kolkata", "shortOffset"],
      ["Australia/Lord_Howe", "longOffset"],
      ["Europe/London", "long"],
      ["Pacific/Chatham", "long"],
    ].map(([timeZone, timeZoneName]) =>
      call(
        `zone-${timeZone}`,
        "DateTimeFormat",
        { hour: "numeric", minute: "2-digit", timeZone, timeZoneName },
        "format",
        at(INSTANT),
      ),
    ),
  },
  {
    id: "ranges",
    rows: [
      dt(
        "range-time",
        { hour: "numeric", minute: "2-digit" },
        "formatRange",
        at("2026-07-04T04:30:00Z"),
        at("2026-07-04T06:00:00Z"),
      ),
      dt(
        "range-day",
        { dateStyle: "long", timeStyle: "short" },
        "formatRange",
        at("2026-07-04T03:00:00Z"),
        at("2026-07-04T07:00:00Z"),
      ),
      dt(
        "range-days",
        { dateStyle: "medium" },
        "formatRange",
        at("2026-07-04T05:00:00Z"),
        at("2026-07-09T05:00:00Z"),
      ),
      dt(
        "range-months",
        { month: "long", day: "numeric" },
        "formatRange",
        at("2026-07-04T05:00:00Z"),
        at("2026-08-20T05:00:00Z"),
      ),
      dt(
        "range-years",
        { dateStyle: "medium" },
        "formatRange",
        at("2026-07-04T05:00:00Z"),
        at("2027-01-15T05:00:00Z"),
      ),
    ],
  },
  {
    id: "relative",
    rows: [
      call("rel-yesterday", "RelativeTimeFormat", { numeric: "auto" }, "format", -1, "day"),
      call("rel-2-days", "RelativeTimeFormat", { numeric: "auto" }, "format", 2, "day"),
      call("rel-3-hours", "RelativeTimeFormat", undefined, "format", -3, "hour"),
      call("rel-5-min", "RelativeTimeFormat", { style: "short" }, "format", 5, "minute"),
      call("rel-weeks", "RelativeTimeFormat", { style: "narrow" }, "format", -1.5, "week"),
      call("rel-quarter", "RelativeTimeFormat", { numeric: "auto" }, "format", 1, "quarter"),
      call("rel-years", "RelativeTimeFormat", undefined, "format", -10, "year"),
    ],
  },
  {
    id: "numbers",
    rows: [
      num("default", undefined, 1234567.891),
      num("percent", { style: "percent", maximumFractionDigits: 1 }, -0.256),
      num("compact-short", { notation: "compact" }, 1234567),
      num("compact-long", { notation: "compact", compactDisplay: "long" }, 1234567),
      num("scientific", { notation: "scientific" }, 0.000123),
      num("engineering", { notation: "engineering" }, 1234567),
      num("significant", { maximumSignificantDigits: 3 }, 1234),
      num("half-even", { maximumFractionDigits: 0, roundingMode: "halfEven" }, 2.5),
      num("except-zero", { signDisplay: "exceptZero" }, 0),
      num("always", { signDisplay: "always" }, 42),
      num("integer-digits", { minimumIntegerDigits: 3 }, 7),
      num("arab", { numberingSystem: "arab" }, 1234567.891),
      num("deva", { numberingSystem: "deva" }, 1234567.891),
      num("thai", { numberingSystem: "thai" }, 1234567.891),
      call("range-kg", "NumberFormat", { style: "unit", unit: "kilogram" }, "formatRange", 3, 5),
      call(
        "range-eur",
        "NumberFormat",
        { style: "currency", currency: "EUR", maximumFractionDigits: 0 },
        "formatRange",
        1000,
        1500,
      ),
      call(
        "range-compact",
        "NumberFormat",
        { notation: "compact" },
        "formatRange",
        1200000,
        1500000,
      ),
      call("range-approx", "NumberFormat", undefined, "formatRange", 3, 3),
    ],
  },
  {
    id: "currency",
    rows: [
      num("eur", { style: "currency", currency: "EUR" }, "1234.50"),
      num(
        "accounting",
        { style: "currency", currency: "EUR", currencySign: "accounting" },
        "-1234.50",
      ),
      num("name-one", { style: "currency", currency: "EUR", currencyDisplay: "name" }, "1"),
      num("name-many", { style: "currency", currency: "EUR", currencyDisplay: "name" }, "1234.50"),
      num("code", { style: "currency", currency: "EUR", currencyDisplay: "code" }, "1234.50"),
      num("compact-eur", { style: "currency", currency: "EUR", notation: "compact" }, "1234567"),
      num(
        "usd-narrow",
        { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" },
        "9.99",
      ),
      num("jpy", { style: "currency", currency: "JPY" }, "1234.5"),
      num("bhd", { style: "currency", currency: "BHD" }, "1234.5"),
      num("thb", { style: "currency", currency: "THB" }, "1234.5"),
      num("egp", { style: "currency", currency: "EGP" }, "1234.5"),
      num("big", { style: "currency", currency: "EUR" }, "12345678901234567890.12"),
    ],
  },
  {
    id: "units",
    rows: [
      num("km-one", { style: "unit", unit: "kilometer", unitDisplay: "long" }, 1),
      num("km-many", { style: "unit", unit: "kilometer", unitDisplay: "long" }, 2.5),
      num("kmh", { style: "unit", unit: "kilometer-per-hour" }, 88),
      num("celsius", { style: "unit", unit: "celsius" }, 21.5),
      num("megabyte", { style: "unit", unit: "megabyte", unitDisplay: "narrow" }, 512),
      num("l-per-km", { style: "unit", unit: "liter-per-kilometer", unitDisplay: "long" }, 3),
      num("meters-compact", { style: "unit", unit: "meter", notation: "compact" }, 1234567),
    ],
  },
  {
    id: "plurals",
    rows: [
      call("categories", "PluralRules", undefined, "resolvedOptions"),
      call("ordinal-categories", "PluralRules", { type: "ordinal" }, "resolvedOptions"),
      ...[0, 1, 2, 3, 11, 100, 1.5].map((n) =>
        call(`select-${n}`, "PluralRules", undefined, "select", n),
      ),
      call("ordinal-22", "PluralRules", { type: "ordinal" }, "select", 22),
      call("select-range", "PluralRules", undefined, "selectRange", 1, 5),
    ],
  },
  {
    id: "lists",
    rows: [
      call("and", "ListFormat", undefined, "format", ["Bangkok", "Cairo", "New York"]),
      call("or", "ListFormat", { type: "disjunction" }, "format", ["Bangkok", "Cairo", "New York"]),
      call("unit-narrow", "ListFormat", { type: "unit", style: "narrow" }, "format", [
        "5 kg",
        "3 g",
      ]),
      call("short", "ListFormat", { style: "short" }, "format", ["Bangkok", "Cairo"]),
    ],
  },
  {
    id: "durations",
    rows: [
      call("duration", "DurationFormat", undefined, "format", DURATION),
      call("duration-long", "DurationFormat", { style: "long" }, "format", DURATION),
      call("duration-narrow", "DurationFormat", { style: "narrow" }, "format", DURATION),
      call(
        "duration-digital",
        "DurationFormat",
        { style: "digital", fractionalDigits: 2 },
        "format",
        DURATION,
      ),
    ],
  },
  {
    id: "names",
    rows: [
      call("lang-de", "DisplayNames", { type: "language" }, "of", "de"),
      call("lang-zh-hant", "DisplayNames", { type: "language" }, "of", "zh-Hant"),
      call(
        "lang-en-gb",
        "DisplayNames",
        { type: "language", languageDisplay: "standard" },
        "of",
        "en-GB",
      ),
      call("region-th", "DisplayNames", { type: "region" }, "of", "TH"),
      call("region-eg", "DisplayNames", { type: "region" }, "of", "EG"),
      call("script", "DisplayNames", { type: "script" }, "of", "Cyrl"),
      call("currency-thb", "DisplayNames", { type: "currency" }, "of", "THB"),
      call("currency-jpy", "DisplayNames", { type: "currency" }, "of", "JPY"),
      call("calendar", "DisplayNames", { type: "calendar" }, "of", "buddhist"),
      call("field", "DisplayNames", { type: "dateTimeField" }, "of", "weekday"),
    ],
  },
  {
    id: "collation",
    rows: [
      call("a-umlaut-z", "Collator", undefined, "compare", "ä", "z"),
      call("apfel", "Collator", undefined, "compare", "apfel", "Äpfel"),
      call("9-10", "Collator", undefined, "compare", "9", "10"),
      call("9-10-numeric", "Collator", { numeric: true }, "compare", "9", "10"),
      call("case-first", "Collator", { caseFirst: "upper" }, "compare", "a", "A"),
      call("base", "Collator", { sensitivity: "base" }, "compare", "résumé", "resume"),
      custom(
        "sort",
        `["Zürich", "Ägypten", "Österreich", "مصر", "ไทย", "apple", "Apple"].sort(new Intl.Collator(lang).compare)`,
        (l) =>
          ["Zürich", "Ägypten", "Österreich", "مصر", "ไทย", "apple", "Apple"].sort(
            new Intl.Collator(l).compare,
          ),
      ),
    ],
  },
  {
    id: "segments",
    rows: [
      call("graphemes", "Segmenter", { granularity: "grapheme" }, "segment", "👨‍👩‍👧‍👦 née"),
      call("words", "Segmenter", { granularity: "word" }, "segment", "It's 3.14 o'clock."),
      call("words-thai", "Segmenter", { granularity: "word" }, "segment", "วันนี้อากาศดีมาก"),
      call("words-japanese", "Segmenter", { granularity: "word" }, "segment", "今日は良い天気"),
      call(
        "sentences",
        "Segmenter",
        { granularity: "sentence" },
        "segment",
        "Dr. Smith arrived. He sat down!",
      ),
    ],
  },
  {
    id: "locale",
    rows: (
      [
        "maximize",
        "minimize",
        "getCalendars",
        "getCollations",
        "getHourCycles",
        "getNumberingSystems",
        "getTextInfo",
        "getWeekInfo",
      ] as const
    ).map((m) =>
      custom(m, `new Intl.Locale(lang).${m}()`, (l) => {
        const out = (new Intl.Locale(l) as unknown as Record<string, () => unknown>)[m]!();
        return out instanceof Intl.Locale ? out.toString() : out;
      }),
    ),
  },
  {
    id: "supported",
    rows: (
      ["calendar", "collation", "currency", "numberingSystem", "timeZone", "unit"] as const
    ).map((key) =>
      custom(key, `Intl.supportedValuesOf("${key}")`, () => {
        const values = Intl.supportedValuesOf(key);
        return `${values.length}: ${values.join(", ")}`;
      }),
    ),
  },
  {
    id: "strings",
    rows: [
      ...[0, 1, 2, 3, 11, 100].map((n) =>
        custom(
          `nights-${n}`,
          `fbt([fbt.plural("night", ${n}, { many: "nights", showCount: "yes" })], "…")`,
          () =>
            fbt(
              [fbt.plural("night", n, { many: "nights", showCount: "yes" })],
              "A number of nights, on the Intl page",
            ),
        ),
      ),
      custom("list", `list(["Bangkok", "Cairo", "New York"])`, () =>
        // fbtee's list() returns an FbtResult (typed as a React node); its text is its toString().
        // oxlint-disable-next-line no-base-to-string
        String(list(["Bangkok", "Cairo", "New York"])),
      ),
      custom(
        "price",
        `fbt(["Price: ", fbt.param("price", new Intl.NumberFormat(lang, { style: "currency", currency: "THB" }).format(1234.5))], "…")`,
        (l) =>
          fbt(
            [
              "Price: ",
              fbt.param(
                "price",
                new Intl.NumberFormat(l, { style: "currency", currency: "THB" }).format(1234.5),
              ),
            ],
            "A price, on the Intl page",
          ),
      ),
    ],
  },
];

/** Every row, run in `locale`: { id: text }. A call the platform doesn't have shows its error. */
export function runAll(locale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of SECTIONS)
    for (const row of section.rows) {
      try {
        out[`${section.id}/${row.id}`] = row.run(locale);
      } catch (error) {
        out[`${section.id}/${row.id}`] = `${(error as Error).name}: ${(error as Error).message}`;
      }
    }
  return out;
}
