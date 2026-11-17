// paymentProblem: AI Gateway's own messages (Cloudflare's AI Gateway docs, "Troubleshooting",
// checked 2026-11-17) read as the account not paying, and nothing else does.
import { expect, test } from "vite-plus/test";
import { paymentProblem } from "../../src/models";

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
});

test("anything else is a bad answer, not payment", () => {
  expect(
    paymentProblem(new Error("google/gemini-3.5-flash gave no complete answer (MAX_TOKENS)")),
  ).toBe(undefined);
  expect(paymentProblem("ai: Not available")).toBe(undefined);
});
