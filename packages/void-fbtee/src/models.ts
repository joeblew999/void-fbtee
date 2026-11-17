// The model void-fbtee translates with, everywhere: the app's strings and pages while `vp dev` runs,
// and what people post, at runtime. One model, so what's reviewed in dev is what production does
// (plans/translation-rework.md).
//
// Gemini 3.5 Flash, wuchale's default (wuchalejs/wuchale src/ai/gemini.ts, v0.26.7, read
// 2026-11-17), through Cloudflare's AI Gateway: a third-party model on Cloudflare's catalog
// (developers.cloudflare.com/ai/models/google/gemini-3.5-flash/, checked 2026-11-17), paid from the
// account's AI Gateway credits (Unified Billing), so no key of ours anywhere. Chosen over Workers
// AI's Gemma 4 on measurement: 48 of 50 strings passed the checks against 44, in 4 requests against
// 92 (plans/translation-rework.md, "Step 2's results", 2026-11-17).

export interface TranslationModel {
  id: string;
  /** US$ per million tokens, from Cloudflare's catalog page, for counting what a run costs. */
  price: { input: number; output: number };
}

export const GEMINI: TranslationModel = {
  id: "google/gemini-3.5-flash",
  // Cloudflare's catalog page (checked 2026-11-17).
  price: { input: 1.5, output: 9 },
};

/**
 * How many strings go in one request, and how many requests at once: wuchale's defaults for
 * Gemini (src/ai/gemini.ts: batchSize 50, parallel 4, read 2026-11-17).
 */
export const BATCH = { size: 50, parallel: 4 };

/** The tokens one request used. Gemini's thinking, when there is any, is paid as output. */
export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/** What a request cost, in US$. */
export const costOf = (u: Usage, model: TranslationModel = GEMINI) =>
  ((u.prompt_tokens ?? 0) * model.price.input + (u.completion_tokens ?? 0) * model.price.output) /
  1e6;
