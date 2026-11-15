// Which Workers AI model translates into which language. The data is models.json: one entry per
// language, each with its model and where the choice comes from. vp dev, the app's own translate()
// and the translator test all read it here. Change a language's model there.
import data from "./models.json" with { type: "json" };

export interface TranslationModel {
  id: string;
  /** Workers AI's JSON Mode (`response_format`) works with it; else JSON is asked for in the
   * prompt and read from the answer's text (ai.ts ask). */
  jsonMode: boolean;
}

export interface Choice {
  /** BCP 47 language subtag: "th" for "th-TH". */
  language: string;
  name: string;
  model: string;
  jsonMode: boolean;
  source: "cloudflare" | "llmgateway" | "measured";
  why: string;
}

/** Every language with its own model. */
export const CHOICES = data.languages as Choice[];
/** Every other language. */
export const DEFAULT = data.default as Omit<Choice, "language" | "name">;

const byLanguage = new Map(CHOICES.map((c) => [c.language, c]));
const model = (c: { model: string; jsonMode: boolean }): TranslationModel => ({
  id: c.model,
  jsonMode: c.jsonMode,
});

/** Llama 3.3 70B, for a request that names no language (ai.ts ask). */
export const LLAMA: TranslationModel = {
  id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  jsonMode: true,
};

/** The model that translates into a language ("th-TH" → SEA-LION). */
export function modelFor(locale: string): TranslationModel {
  return model(byLanguage.get(new Intl.Locale(locale).language) ?? DEFAULT);
}

/** The choice for a language, or undefined when it takes the default. */
export const choiceFor = (locale: string): Choice | undefined =>
  byLanguage.get(new Intl.Locale(locale).language);

/** A model by its id, for trying another one (the translator test's TRANSLATOR_MODEL). */
export function modelById(id: string): TranslationModel {
  const known = [...CHOICES, DEFAULT].find((c) => c.model === id);
  return known ? model(known) : { id, jsonMode: id === LLAMA.id };
}
