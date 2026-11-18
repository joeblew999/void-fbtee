// paymentProblem: AI Gateway's own messages (Cloudflare's AI Gateway docs, "Troubleshooting",
// checked 2026-11-17) read as the account not paying, and nothing else does.
import { expect, test } from "vite-plus/test";
import { costOf, GEMINI, paymentProblem, spent } from "../../src/models";

test("credits used up", () => {
  expect(
    paymentProblem(
      new Error(
        "AiError: 402: Insufficient unified billing balance for this request. Your available balance is $0.00.",
      ),
    ),
  ).toBe("credits");
  expect(paymentProblem("Insufficient balance; add money to your gateway or use BYOK")).toBe(
    "credits",
  );
});

test("a limit reached", () => {
  expect(
    paymentProblem(
      "Unified billing rate limit exceeded for this gateway. Please reduce request rate or use BYOK.",
    ),
  ).toBe("limit");
  expect(paymentProblem("429 Too Many Requests: spend limit reached")).toBe("limit");
  // What Void's runtime throws for any 429 (runtime/ai.mjs limitFromResponse).
  expect(paymentProblem("AI is temporarily unavailable because its usage limit was reached.")).toBe(
    "limit",
  );
});

test("anything else is a bad answer, not payment", () => {
  expect(
    paymentProblem(new Error("google/gemini-3.5-flash gave no complete answer (MAX_TOKENS)")),
  ).toBe(undefined);
  expect(paymentProblem("ai: Not available")).toBe(undefined);
});

test("Hydrogen's price: US$1.50 a million tokens in, US$7.50 out, thinking paid as out", () => {
  expect(GEMINI.id).toBe("google/gemini-4-hydrogen");
  expect(costOf({ in: 1e6, out: 0, thinking: 0 })).toBe(1.5);
  expect(costOf({ in: 0, out: 5e5, thinking: 5e5 })).toBe(7.5);
  expect(spent([{ in: 263, out: 58, thinking: 136 }])).toEqual({
    in: 263,
    out: 58,
    thinking: 136,
    usd: 0.00185,
  });
});
