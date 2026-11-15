// Which Workers AI model translates into which language (ai.ts). Each choice says where it comes
// from, checked 2026-11-15:
// - "cloudflare": Cloudflare's own docs name the language for the model (its model page or
//   changelog).
// - "llmgateway": https://llmgateway.io/models/translation, a third party's recommendation by
//   language family, not Cloudflare's. A starting point until the translator test measures it.
// - "measured": scored by the translator test on the package's test strings
//   (test/translator/scores.json, `vp run test:translator`).
// Every model here is in Cloudflare's catalog and not on its November 2026 deprecation list
// (changelog, 2026-11-05: retired November 20). Replace a choice when the test shows a better one,
// and say so in `source`.
//
// Not used, and why: IndicTrans2 (`@cf/ai4bharat/indictrans2-en-indic-1B`, Cloudflare: 22 Indian
// languages) translates only from English and takes no description, examples or rules, which every
// string here needs; m2m100 (`@cf/meta/m2m100-1.2b`, Cloudflare: many-to-many translation)
// translates sentences alone and scored chrF 29.6 against Llama's 53.0 on the example's events
// (2026-11-13). Kimi K2.6 and the other models on the deprecation list are out.

export interface TranslationModel {
  id: string;
  /** Whether Workers AI's JSON Mode (`response_format`) works with it: Workers AI's "JSON Mode"
   * page lists the models that support it. Without it, JSON is asked for in the prompt and read
   * from the answer's text (ai.ts ask). */
  jsonMode: boolean;
}

/** Llama 3.3 70B: listed for JSON Mode. */
export const LLAMA: TranslationModel = {
  id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  jsonMode: true,
};
/** SEA-LION v4 27B: Cloudflare's changelog (2025-09-24) names its Southeast Asian languages. */
export const SEA_LION: TranslationModel = {
  id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
  jsonMode: false,
};
/** Gemma 4 26B: one of Cloudflare's suggested replacements (deprecation changelog, 2026-11-05). */
export const GEMMA: TranslationModel = { id: "@cf/google/gemma-4-26b-a4b-it", jsonMode: false };
/** Qwen 3.8 27B: one of Cloudflare's suggested replacements (deprecation changelog, 2026-11-05). */
export const QWEN: TranslationModel = { id: "@cf/qwen/qwen3.8-27b", jsonMode: false };
/** gpt-oss-120b: Cloudflare's model page: production, general purpose, high reasoning. */
export const GPT_OSS: TranslationModel = { id: "@cf/openai/gpt-oss-120b", jsonMode: false };
/** GLM 4.7 Flash: Cloudflare's model page: multilingual, "100+ languages". */
export const GLM: TranslationModel = { id: "@cf/zai-org/glm-4.7-flash", jsonMode: false };

type Source = "cloudflare" | "llmgateway" | "measured";
interface Choice {
  model: TranslationModel;
  source: Source;
  /** What the source says, or the measured score. */
  why: string;
}

const sea: Choice = {
  model: SEA_LION,
  source: "cloudflare",
  why: "changelog 2025-09-24 lists the language",
};
const cjk: Choice = {
  model: QWEN,
  source: "llmgateway",
  why: "Qwen and GLM for Chinese, Japanese and Korean",
};
const europe: Choice = {
  model: GEMMA,
  source: "llmgateway",
  why: "Gemma 4 for European languages",
};
const rtlSlavic: Choice = {
  model: GPT_OSS,
  source: "llmgateway",
  why: "gpt-oss-120b or Llama 3.3 for Arabic, Hebrew, Turkish, Russian, Ukrainian",
};
const indic: Choice = {
  model: GLM,
  source: "cloudflare",
  why: "IndicTrans2 can't take our prompt; GLM 4.7 Flash covers 100+ languages",
};

/** By the BCP 47 language subtag ("th" for "th-TH"). Anything not here: DEFAULT. */
export const CHOICES: Record<string, Choice> = {
  // Southeast Asia (SEA-LION)
  th: { ...sea, why: "measured: chrF 80, 10/10 pass (2026-11-15); changelog lists Thai" },
  vi: sea,
  id: sea,
  ms: sea,
  tl: sea,
  fil: sea,
  km: sea,
  lo: sea,
  my: sea,
  ta: sea,
  // Chinese, Japanese, Korean
  zh: cjk,
  ja: cjk,
  ko: cjk,
  // Arabic and its neighbours, Hebrew, Persian, Turkish; Russian and Ukrainian
  ar: {
    model: LLAMA,
    source: "measured",
    why: "chrF 65, 10/10 pass (2026-11-15); llmgateway suggests gpt-oss-120b, untested",
  },
  he: rtlSlavic,
  fa: rtlSlavic,
  tr: rtlSlavic,
  ru: rtlSlavic,
  uk: rtlSlavic,
  // Indian languages
  hi: indic,
  bn: indic,
  ur: indic,
  gu: indic,
  mr: indic,
  te: indic,
  kn: indic,
  ml: indic,
  pa: indic,
  ne: indic,
  // Europe
  en: europe,
  de: europe,
  fr: europe,
  es: europe,
  it: europe,
  pt: europe,
  nl: europe,
  pl: europe,
  sv: europe,
  da: europe,
  nb: europe,
  no: europe,
  fi: europe,
  cs: europe,
  ro: europe,
  hu: europe,
  el: europe,
  bg: europe,
};

/** Every other language: GLM 4.7 Flash, "100+ languages" (Cloudflare's model page). */
export const DEFAULT: Choice = {
  model: GLM,
  source: "cloudflare",
  why: "model page: multilingual, 100+ languages",
};

/** The model that translates into a language ("th-TH" → SEA-LION). */
export function modelFor(locale: string): TranslationModel {
  return (CHOICES[new Intl.Locale(locale).language] ?? DEFAULT).model;
}

/** A model by its id, for trying another one (the translator test's TRANSLATOR_MODEL). */
export function modelById(id: string): TranslationModel {
  return (
    [LLAMA, SEA_LION, GEMMA, QWEN, GPT_OSS, GLM].find((m) => m.id === id) ?? {
      id,
      jsonMode: false,
    }
  );
}
