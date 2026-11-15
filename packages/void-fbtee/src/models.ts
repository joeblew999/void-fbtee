// Which Workers AI model translates into which language. The data is models.json: each model with
// its own settings, and one entry per language naming its model and where the choice comes from.
// vp dev, the app's own translate() and the translator test all read it here. Change a language's
// model there.
import data from "./models.json" with { type: "json" };

export interface TranslationModel {
  id: string;
  /** Workers AI's JSON Mode (`response_format`) works with it; else JSON is asked for in the
   * prompt and read from the answer's text (ai.ts ask). */
  jsonMode: boolean;
  /** Sent with every request to it (ai.ts ask): its thinking turned off or to its lowest. */
  options?: Record<string, unknown>;
}

export interface Choice {
  /** BCP 47 language subtag: "th" for "th-TH". */
  language: string;
  name: string;
  model: string;
  source: "cloudflare" | "llmgateway" | "measured";
  why: string;
}

const MODELS = data.models as Record<string, Omit<TranslationModel, "id"> & { why: string }>;

/** Every model void-fbtee translates with: the translator test's candidates for a language. */
export const CANDIDATES: TranslationModel[] = Object.entries(MODELS).map(([id, m]) => ({
  id,
  jsonMode: m.jsonMode,
  ...(m.options && { options: m.options }),
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
