// Which of the app's languages a visitor gets, by fbtee's own rule, so the whole app chooses a
// language one way.
//
// negotiateLocale() and what it uses are copied from fbtee 6.0.0 (lib/index-core-44-4LnRZ.mjs:
// localeIdentifier.tsx and localeFallback.tsx), MIT License, Copyright (c) Nakazawa Tech & Meta
// Platforms, Inc. and affiliates. fbtee doesn't export them, and setupLocaleContext(), the only way
// to them, changes fbtee's global setup (not safe in middleware). One change: fbtee's
// getLocaleHierarchy keeps every tag it has seen in a module-level Map, never cleared; on a server
// those tags come from every visitor's header, so this copy keeps nothing. A unit test checks the
// answers equal setupLocaleContext(...).getLocale(); when fbtee exports negotiateLocale
// (plans/their-own-language.md, issue 1), this copy goes and fbtee's is called.

/** The most entries of an Accept-Language header read: a real browser sends a handful. */
const MOST = 20;

/**
 * The visitor's languages from `Accept-Language`, best first: by `q`, the header's own order
 * breaking ties; `*`, `q=0` and tags Intl rejects skipped; at most the first 20 entries read.
 */
export function acceptedLanguages(header: string | null | undefined): string[] {
  if (!header) return [];
  const entries = header
    .split(",")
    .slice(0, MOST)
    .map((part, order) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q === undefined ? 1 : Number(q.slice(2));
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, order };
    })
    .filter(({ tag, weight }) => tag && tag !== "*" && weight > 0 && valid(tag));
  entries.sort((a, b) => b.weight - a.weight || a.order - b.order);
  return entries.map(({ tag }) => tag);
}

function valid(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length > 0;
  } catch {
    return false;
  }
}

/**
 * The app's language for a visitor: the first of their languages (best first) the app can serve,
 * matched by fbtee's rule, else the fallback. As fbtee's setupLocaleContext({ clientLocales,
 * fallbackLocale }).getLocale().
 */
export function negotiate(
  visitor: readonly string[],
  locales: readonly string[],
  fallbackLocale: string,
): string {
  for (const locale of visitor) {
    const found = negotiateLocale(locale, locales);
    if (found) return found;
  }
  return negotiateLocale(fallbackLocale, locales) ?? fallbackLocale;
}

// --- fbtee 6.0.0, localeIdentifier.tsx ---

const legacyToBCP47: Record<string, string> = {
  ar_AR: "ar",
  es_LA: "es-419",
  fb_AA: "fb-AA",
  fb_AC: "fb-AC",
  fb_AR: "ar",
  fb_HA: "fb-HA",
  fb_HX: "fb-HX",
  fb_LL: "fb-LL",
  fb_LS: "fb-LS",
  fb_RL: "fb-RL",
  fb_ZH: "zh",
  fbt_AC: "fbt-AC",
};
const specialLocaleToLanguage: Record<string, string> = {
  bp_IN: "bho",
  bv_DE: "bar",
  cb_IQ: "ckb",
  ck_US: "chr",
  cx_PH: "ceb",
  eh_IN: "hi",
  em_ZM: "bem",
  fb_AA: "en",
  fb_AC: "en",
  fb_AR: "ar",
  fb_HA: "en",
  fb_HX: "en",
  fb_LL: "en",
  fb_LS: "en",
  fb_RL: "en",
  fb_ZH: "zh",
  fbt_AC: "en",
  fn_IT: "fur",
  fv_NG: "fuv",
  gx_GR: "grc",
  lr_IT: "lij",
  nh_MX: "nah",
  ns_ZA: "nso",
  qb_DE: "hsb",
  qc_GT: "quc",
  qe_US: "esu",
  qk_DZ: "kab",
  qr_GR: "rup",
  qs_DE: "dsb",
  qt_US: "tli",
  qv_IT: "vec",
  qz_MM: "my",
  sy_SY: "syr",
  sz_PL: "szl",
  tl_PH: "fil",
  tl_ST: "tlh",
  tq_AR: "tob",
  tz_MA: "tzm",
  zz_TR: "zza",
};

function canonicalizeBCP47(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] || locale;
  } catch {
    return locale;
  }
}

function getLegacyAlias(locale: string): string | null {
  const match = locale
    .trim()
    .replaceAll("-", "_")
    .match(/^([a-z]{2,3})_([\da-z]{2,3})$/i);
  if (!match) return null;
  return `${match[1]!.toLowerCase()}_${match[2]!.toUpperCase()}`;
}

function getLocaleIdentity(locale: string): string {
  const trimmed = locale.trim();
  const legacyAlias = getLegacyAlias(trimmed);
  if (legacyAlias) {
    const special = legacyToBCP47[legacyAlias];
    if (special) return canonicalizeBCP47(special);
    const specialLanguage = specialLocaleToLanguage[legacyAlias];
    if (specialLanguage) {
      const [, region] = legacyAlias.split("_");
      return canonicalizeBCP47(`${specialLanguage}-${region}`);
    }
    return canonicalizeBCP47(legacyAlias.replaceAll("_", "-"));
  }
  return canonicalizeBCP47(trimmed.replaceAll("_", "-"));
}

// --- fbtee 6.0.0, localeFallback.tsx (getLocaleHierarchy without its cache) ---

function parseLocale(locale: string): Intl.Locale | null {
  try {
    return new Intl.Locale(locale);
  } catch {
    return null;
  }
}

/** Locale parents must not silently switch writing systems (e.g. Hant to Hans). */
function getLocaleHierarchy(locale: string): string[] {
  const identity = getLocaleIdentity(locale);
  const result = new Set([identity]);
  const parsed = parseLocale(identity);
  if (parsed) {
    result.add(parsed.baseName);
    result.add([parsed.language, parsed.script, parsed.region].filter(Boolean).join("-"));
    const script = parsed.maximize().script;
    if (script) result.add(`${parsed.language}-${script}`);
    if (script === new Intl.Locale(parsed.language).maximize().script) result.add(parsed.language);
  }
  return Array.from(result);
}

// getLocaleFallbackChain with no fallbackLocales, as negotiateLocale calls it.
function getLocaleFallbackChain(locale: string, sourceLocale: string): string[] {
  const result = new Set<string>();
  const append = (value: string) => {
    for (const parent of getLocaleHierarchy(value)) result.add(parent);
  };
  append(locale);
  append(sourceLocale);
  return Array.from(result);
}

/** Match identities, not lossy aliases: zh-Hant-TW and zh-Hans-TW are distinct. */
function getAvailableLocaleChain(
  locale: string,
  available: readonly string[],
  sourceLocale: string,
): string[] {
  return Array.from(
    new Set(
      getLocaleFallbackChain(locale, sourceLocale).flatMap((identity) =>
        available
          .filter((candidate) => areEquivalentLocales(candidate, identity))
          .sort((a, b) => (a === identity ? -1 : b === identity ? 1 : a < b ? -1 : a > b ? 1 : 0)),
      ),
    ),
  );
}

function areEquivalentLocales(a: string, b: string): boolean {
  const left = getLocaleIdentity(a);
  const right = getLocaleIdentity(b);
  if (left === right) return true;
  const leftLocale = parseLocale(left);
  const rightLocale = parseLocale(right);
  return (
    !!leftLocale &&
    !!rightLocale &&
    left === leftLocale.baseName &&
    right === rightLocale.baseName &&
    leftLocale.language === rightLocale.language &&
    leftLocale.region === rightLocale.region &&
    leftLocale.maximize().baseName === rightLocale.maximize().baseName
  );
}

/** Prefer exact matches and parents, then a deterministic region with the same script. */
export function negotiateLocale(locale: string, availableLocales: Iterable<string>): string | null {
  const available = Array.from(availableLocales);
  const parents = getAvailableLocaleChain(locale, available, locale);
  if (parents.length) return parents[0]!;
  const requested = parseLocale(getLocaleIdentity(locale));
  if (!requested) return null;
  const maximized = requested.maximize();
  const defaultRegion = new Intl.Locale(
    [requested.language, maximized.script].filter(Boolean).join("-"),
  ).maximize().region;
  const score = (value: Intl.Locale | null) =>
    value?.region === maximized.region ? 2 : value?.region === defaultRegion ? 1 : 0;
  return (
    available
      .map((name) => ({ locale: parseLocale(getLocaleIdentity(name)), name }))
      .filter(
        ({ locale }) =>
          locale &&
          locale.language === requested.language &&
          locale.maximize().script === maximized.script,
      )
      .sort(
        (a, b) =>
          score(b.locale) - score(a.locale) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      )[0]?.name ?? null
  );
}
