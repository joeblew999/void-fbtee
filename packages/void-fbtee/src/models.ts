// Which Workers AI model translates into which language. The data is models.json: each model with
// its own settings, and one entry per language naming its model and where the choice comes from.
// vp dev and the app's own translate() read it here. Change a language's model there.
import data from "./models.json" with { type: "json" };

export interface TranslationModel {
  id: string;
  /** Workers AI's JSON Mode (`response_format`) works with it; else JSON is asked for in the
   * prompt and read from the answer's text (ai.ts ask). */
  jsonMode: boolean;
  /** Sent with every request to it (ai.ts ask): its thinking turned off or to its lowest. */
  options?: Record<string, unknown>;
  /** Workers AI's requests a minute for it (translate.ts routeCall): 300 for text generation,
   * unless the model requires the Workers Paid plan (models.json perMinute, 20). */
  perMinute: number;
}

export interface Choice {
  /** BCP 47 language subtag: "th" for "th-TH". */
  language: string;
  name: string;
  model: string;
  source: "cloudflare" | "llmgateway" | "measured";
  why: string;
}

const MODELS = data.models as Record<
  string,
  Omit<TranslationModel, "id" | "perMinute"> & { perMinute?: number; why: string }
>;

/** Every model void-fbtee can translate with (models.json models). */
export const CANDIDATES: TranslationModel[] = Object.entries(MODELS).map(([id, m]) => ({
  id,
  jsonMode: m.jsonMode,
  ...(m.options && { options: m.options }),
  // Workers AI's limit for text generation, for every model not paid-only (Workers AI "Limits",
  // checked 2026-11-15).
  perMinute: m.perMinute ?? 300,
}));
/** Every language with its own model. */
export const CHOICES = data.languages as Choice[];
/** Every other language. */
export const DEFAULT = data.default as Omit<Choice, "language" | "name">;

const byLanguage = new Map(CHOICES.map((c) => [c.language, c]));

/** A model by its id, with its settings from models.json. */
export function modelById(id: string): TranslationModel {
  const known = CANDIDATES.find((m) => m.id === id);
  if (!known) throw new Error(`${id} isn't in void-fbtee's models.json`);
  return known;
}

/** Llama 3.3 70B, for a request that names no language (ai.ts ask). */
export const LLAMA: TranslationModel = modelById("@cf/meta/llama-3.3-70b-instruct-fp8-fast");

/** The model that translates into a language ("th-TH" → SEA-LION). */
export function modelFor(locale: string): TranslationModel {
  return modelById((byLanguage.get(new Intl.Locale(locale).language) ?? DEFAULT).model);
}

/** The choice for a language, or undefined when it takes the default. */
export const choiceFor = (locale: string): Choice | undefined =>
  byLanguage.get(new Intl.Locale(locale).language);

/**
 * Gemini 3.5 Flash, Google's model, through Cloudflare's AI Gateway: wuchale's default
 * (wuchalejs/wuchale src/ai/gemini.ts, read 2026-11-17). A third-party model on Cloudflare's
 * catalog (developers.cloudflare.com/ai/models/google/gemini-3.5-flash/, checked 2026-11-17), paid
 * from the account's AI Gateway credits (Unified Billing): no key of ours. Being measured against
 * the Workers AI models (plans/translation-rework.md, step 2); not used unless a request names it.
 */
export const GEMINI: TranslationModel & { price: { input: number; output: number } } = {
  id: "google/gemini-3.5-flash",
  jsonMode: false,
  perMinute: 300,
  // US$ per million tokens, Cloudflare's catalog page (checked 2026-11-17).
  price: { input: 1.5, output: 9 },
};

/** A model that isn't Workers AI's own (`@cf/…`): sent through the gateway to its provider. */
export const thirdParty = (model: TranslationModel) => !model.id.startsWith("@cf/");

/** The tokens one request used, as the answer reports them (OpenAI's `usage`). */
export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}
