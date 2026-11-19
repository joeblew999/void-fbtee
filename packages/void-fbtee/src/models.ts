// The model void-fbtee translates with, everywhere: the app's strings and pages while `vp dev` runs,
// and what people post, at runtime. One model, so what's reviewed in dev is what production does.
// Through Cloudflare's AI Gateway, paid from the account's credits (Unified Billing), so no key of
// ours anywhere (plans/translation-simple.md).

export interface TranslationModel {
  id: string;
  /** US$ per million tokens, in and out; thinking is paid as out. */
  price: { input: number; output: number };
}

/**
 * Gemini 4 Hydrogen, Google's current fast model (released 2026-11-12; on Cloudflare's model list,
 * developers.cloudflare.com/ai/models/, checked 2026-11-18). Its price: Google's Gemini API pricing
 * page (ai.google.dev/gemini-api/docs/pricing, checked 2026-11-18).
 */
export const GEMINI: TranslationModel = {
  id: "google/gemini-4-hydrogen",
  price: { input: 1.5, output: 7.5 },
};

/** The tokens one request used: in, out, and thinking (paid as out). */
export interface Usage {
  in: number;
  out: number;
  thinking: number;
}

/** What a request cost, in US$, at the model's price. */
export const costOf = (u: Usage, model: TranslationModel = GEMINI) =>
  (u.in * model.price.input + (u.out + u.thinking) * model.price.output) / 1e6;

/** What a translation cost, as it's kept with it (`usage`): its tokens, and the US$ they came to. */
export interface Spent extends Usage {
  usd: number;
}

/** Several requests' tokens added up, with their cost: a translation asked for more than once. */
export function spent(usages: Array<Usage>, model: TranslationModel = GEMINI): Spent {
  const sum = usages.reduce(
    (a, u) => ({ in: a.in + u.in, out: a.out + u.out, thinking: a.thinking + u.thinking }),
    { in: 0, out: 0, thinking: 0 },
  );
  // Rounded to a millionth of a dollar: what the tokens can say.
  return { ...sum, usd: Math.round(costOf(sum, model) * 1e6) / 1e6 };
}

/**
 * Whether an error from the model is the account not paying for it, not a bad answer: "credits",
 * the AI Gateway credits are used up (HTTP 402, codes 2052 and 2021, "Insufficient … balance");
 * "limit", a spend limit set on the gateway is reached, or its Unified Billing request rate (HTTP
 * 429, code 2018). Cloudflare's AI Gateway docs, "Troubleshooting" and "Spend limits" (checked
 * 2026-11-17). Asking again won't help until someone tops up or the limit's window passes.
 */
export function paymentProblem(error: unknown): "credits" | "limit" | undefined {
  const text = String(error);
  if (/insufficient[^.]*balance|\b(2052|2021)\b|\b402\b/i.test(text)) {
    return "credits";
  }
  // Void's runtime turns any 429 into its own error before the answer reaches us
  // (runtime/ai.mjs limitFromResponse: "…because its usage limit was reached").
  if (/spend limit|rate limit|usage limit|\b2018\b|\b429\b/i.test(text)) {
    return "limit";
  }
  return undefined;
}

/** What to do about a paymentProblem, said once in the dev server's log or the Worker's. */
export const paymentAdvice = {
  credits:
    "the account's AI Gateway credits are used up: top them up in the Cloudflare dashboard, AI > AI Gateway > Credits (https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)",
  limit:
    "a spend limit on the AI Gateway is reached (or its request rate): it frees up when the limit's window passes (https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)",
};
