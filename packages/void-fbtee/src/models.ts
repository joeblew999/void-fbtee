// Which Workers AI model translates into which language (ai.ts). Chosen from Cloudflare's own
// docs, checked 2026-11-15, and from measuring on the example's own catalogs
// (`vp run measure:translator`, scripts/translator.ts). Check again when Cloudflare's catalog
// changes: https://developers.cloudflare.com/workers-ai/models/ and its changelog.
//
// - SEA-LION (`@cf/aisingapore/gemma-sea-lion-v4-27b-it`): Cloudflare's changelog (2025-09-24)
//   names the Southeast Asian languages it supports: Burmese, English, Indonesian, Khmer, Lao,
//   Malay, Mandarin, Tagalog, Tamil, Thai and Vietnamese.
// - Everything else: Llama 3.3 70B. It's the model JSON Mode lists first (Workers AI's "JSON
//   Mode" page, "Supported Models", checked 2026-11-15), which makes its answers parse; it isn't on
//   Cloudflare's November 2026 deprecation list (changelog, 2026-11-05: retired November 20); and
//   on the example's Arabic it scored chrF 77.8 with every answer passing the checks (2026-11-15).
// - Not used, and why: IndicTrans2 (`@cf/ai4bharat/indictrans2-en-indic-1B`) translates only from
//   English and has no room for a description or examples; m2m100 translates sentences alone and
//   scored 29.6 against Llama's 53.0 on the example's events (2026-11-13).

export interface TranslationModel {
  id: string;
  /** Whether Workers AI's JSON Mode (`response_format`) works with it; else JSON is asked for in
   * the prompt and read from the answer's text. */
  jsonMode: boolean;
}

export const LLAMA: TranslationModel = {
  id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  jsonMode: true,
};
export const SEA_LION: TranslationModel = {
  id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
  jsonMode: false,
};

/** Languages by their BCP 47 language subtag, as Cloudflare's changelog names them for SEA-LION. */
const BY_LANGUAGE: Record<string, TranslationModel> = {
  th: SEA_LION, // Thai
  vi: SEA_LION, // Vietnamese
  id: SEA_LION, // Indonesian
  ms: SEA_LION, // Malay
  tl: SEA_LION, // Tagalog
  fil: SEA_LION, // Filipino (Tagalog)
  km: SEA_LION, // Khmer
  lo: SEA_LION, // Lao
  my: SEA_LION, // Burmese
  ta: SEA_LION, // Tamil
};

/** The model that translates into a language ("th-TH" → SEA-LION). */
export function modelFor(locale: string): TranslationModel {
  const language = new Intl.Locale(locale).language;
  return BY_LANGUAGE[language] ?? LLAMA;
}

/** A model by its id, for the measurement's own choice of model. */
export function modelById(id: string): TranslationModel {
  return [LLAMA, SEA_LION].find((m) => m.id === id) ?? { id, jsonMode: false };
}
