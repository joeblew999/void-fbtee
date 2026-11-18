// Dev server: the package's translation code, all the way to real Gemini (plans/translation-simple.md,
// "Tests"). The six test entries written by hand (packages/void-fbtee/test/entries.json), each sent
// through the dev server's own route (POST /__void-fbtee/translate, ai.ts devTranslate), which
// translates with Void's AI and writes nothing, into Thai and Arabic. It checks what our code is
// for, never the wording: every line back under its own name, nothing that would break the app,
// and what it cost. A few US cents a run; test:dev isn't run in CI.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, inject, test } from "vite-plus/test";
import entries from "../../packages/void-fbtee/test/entries.json" with { type: "json" };
import { url } from "../helpers";

const skip = inject("devSkip" as never) as string;
// The token the dev server writes as it starts, for a request from outside it.
const token = () =>
  readFileSync(
    join(import.meta.dirname, "../../apps/example/node_modules/.void-fbtee/dev-token"),
    "utf8",
  ).trim();

for (const to of ["th-TH", "ar-EG"])
  test.skipIf(!!skip)(
    `the six test entries into ${to}, through the dev route to Gemini`,
    async () => {
      for (const [key, e] of Object.entries(entries.translations)) {
        const entry = {
          description: e.description,
          lines: e.translations.map((l) => ({ text: l.translation, variations: l.variations })),
        };
        const r = await fetch(`${url("prod")}/__void-fbtee/translate`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-void-fbtee-token": token() },
          body: JSON.stringify({ kind: "string", from: "en-US", to, entry }),
        });
        expect(r.status, key).toBe(200);
        const answer = (await r.json()) as {
          result: (string | null)[];
          problems: string[];
          usage: { in: number; out: number; thinking: number; usd: number };
          model: string;
        };
        expect(answer.model).toBe("google/gemini-4-hydrogen");
        expect(answer.problems, key).toEqual([]);
        expect(answer.result, key).toHaveLength(entry.lines.length);
        for (const line of answer.result)
          expect(typeof line === "string" && line.trim(), key).toBeTruthy();
        expect(answer.usage.in, key).toBeGreaterThan(0);
        expect(answer.usage.usd, key).toBeGreaterThan(0);
      }
    },
  );
