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

/**
 * Whether an error from the model is the account not paying for it, not a bad answer: "credits",
 * the AI Gateway credits are used up (HTTP 402, codes 2052 and 2021, "Insufficient … balance");
 * "limit", a spend limit set on the gateway is reached, or its Unified Billing request rate (HTTP
 * 429, code 2018). Cloudflare's AI Gateway docs, "Troubleshooting" and "Spend limits" (checked
 * 2026-11-17). Asking again won't help until someone tops up or the limit's window passes.
 */
export function paymentProblem(error: unknown): "credits" | "limit" | undefined {
  const text = String(error);
  if (/insufficient[^.]*balance|\b(2052|2021)\b|\b402\b/i.test(text)) return "credits";
  if (/spend limit|rate limit|\b2018\b|\b429\b/i.test(text)) return "limit";
  return undefined;
}

/** What to do about a paymentProblem, said once in the dev server's log or the Worker's. */
export const paymentAdvice = {
  credits:
    "the account's AI Gateway credits are used up: top them up in the Cloudflare dashboard, AI > AI Gateway > Credits (https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)",
  limit:
    "a spend limit on the AI Gateway is reached (or its request rate): it frees up when the limit's window passes (https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)",
};
