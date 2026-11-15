// Whether we control AI Gateway's cache for Void's AI, per request, both ways (translation turns it
// off: ai.ts ask). On the example's own
// Cloudflare account, `ai.run()`'s third argument is the Workers AI binding's: `gateway.id` sends
// the request through AI Gateway ("default" is made on the first request), and `cacheTtl` or
// `skipCache` turn its cache on or off (Cloudflare's AI Gateway docs, "Workers Bindings",
// 2026-11-05; Void's guide/ai.md passes the third argument on). One request the model words
// differently each time (ai.ts cacheProbe), asked twice each way:
// - cache on: the same answer twice, the second from the cache;
// - cache off: two different answers.
// `vp test run --project translator e2e/translator/cache.test.ts --silent=false` shows them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import { EXAMPLE } from "../preview/setup";

const skip = inject("devSkip" as never) as string;
const site = inject("prod" as never) as string;

async function probe(cache: "on" | "off"): Promise<{ answer: string; status?: string }> {
  const token = readFileSync(join(EXAMPLE, "node_modules/.void-fbtee/dev-token"), "utf8").trim();
  const res = await fetch(`${site}/__void-fbtee/translate`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-void-fbtee-token": token },
    body: JSON.stringify({ kind: "cache-probe", cache }),
  });
  const body = (await res.json()) as {
    answer?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  expect(res.ok, body.error).toBe(true);
  console.log(`  ${cache}: ${JSON.stringify(body.headers)}`);
  return { answer: body.answer!, status: body.headers?.["cf-aig-cache-status"] };
}

// AI Gateway stores an answer after giving it, not before: a second request a second later can
// still miss (two MISSes in a row, 2026-11-15, then a HIT on the next run). So the answer is asked
// for again, a second apart, until the gateway says HIT, and that answer is one it gave before.
test.skipIf(!!skip)("cache on: a later answer is an earlier one, from the cache", async () => {
  const seen = [await probe("on")];
  for (let i = 0; i < 5 && seen.at(-1)!.status !== "HIT"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    seen.push(await probe("on"));
  }
  console.log(`cache on:\n${seen.map((s) => `  ${s.status}: ${s.answer}`).join("\n")}`);
  const hit = seen.at(-1)!;
  expect(hit.status, "with gateway.id and cacheTtl, the gateway answers from its cache").toBe(
    "HIT",
  );
  expect(seen.slice(0, -1).map((s) => s.answer)).toContain(hit.answer);
});

test.skipIf(!!skip)("cache off: two different answers, neither from the cache", async () => {
  const [a, b] = [await probe("off"), await probe("off")];
  console.log(`cache off:\n  ${a.answer}\n  ${b.answer}`);
  expect(b.answer, "with skipCache, a fresh answer each time").not.toBe(a.answer);
  expect([a.status, b.status], "and the gateway says so").not.toContain("HIT");
});
