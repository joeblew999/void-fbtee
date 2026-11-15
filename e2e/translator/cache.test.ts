// Whether AI Gateway's cache answers Void's AI requests, and whether skipping it per request works
// (ai.ts: every translation skips it, so a wrong first answer can't come back from the cache). One
// request the model words differently each time (cacheProbe: temperature 1.5), sent twice:
// - cache allowed, the same answer twice: the cache answered the second, so it's on;
// - cache skipped, two different answers: skipCache works.
// If the cache allowed gives two different answers, the gateway isn't caching at all, and
// skipCache changes nothing: the test says so and passes. `vp run test:translator`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;

async function probe(skipCache: boolean): Promise<string> {
  const token = readFileSync(join(EXAMPLE, "node_modules/.void-fbtee/dev-token"), "utf8").trim();
  const res = await fetch(`${site}/__void-fbtee/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-void-fbtee-token": token },
    body: JSON.stringify({ kind: "cache-probe", skipCache }),
  });
  const body = (await res.json()) as { answer?: string; error?: string };
  expect(res.ok, body.error).toBe(true);
  return body.answer!;
}

test.skipIf(!!skip)("AI Gateway's cache: on or off, and skipCache skips it", async () => {
  const [a, b] = [await probe(false), await probe(false)];
  const cached = a === b;
  console.log(
    `cache allowed: ${cached ? "the same answer twice (cached)" : "two answers (not cached)"}\n  ${a}\n  ${b}`,
  );
  if (!cached) {
    console.log("AI Gateway isn't caching these requests: skipCache changes nothing.");
    return;
  }
  const [c, d] = [await probe(true), await probe(true)];
  console.log(`cache skipped:\n  ${c}\n  ${d}`);
  expect(c, "with skipCache, a fresh answer each time").not.toBe(d);
});
