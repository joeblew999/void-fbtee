// The Temporal page, in each browser (engines.ts): each row's neutral result on the Worker (the
// polyfill, and Cloudflare's own Temporal), with the browser's own Temporal (where it has one)
// and with the polyfill in the browser. Neutral results don't depend on locale data, so every row must be the same three ways:
// a row that differs is a real bug in one implementation, and the test names it. The results
// are the same in every language, so one is enough.
import { describe, expect, test } from "vite-plus/test";
import { browser, collectErrors, untilText } from "../helpers";
import { SOURCE } from "../locales";
import { ENGINES, prepare } from "./engines";

for (const e of ENGINES) {
  describe(e.name, () => {
    const open = browser("prod", e.engine);
    test("every Temporal row the same four ways: the Worker's polyfill and own, the browser's", async () => {
      const p = await open();
      await prepare(p, e);
      const errors = collectErrors(p);
      await p.goto(`/${SOURCE}/docs/temporal`);
      await untilText(p, '[data-testid="temporal-polyfill"]', "not", "");
      // Each row's four results: the polyfill on the Worker (the reference), Cloudflare's own,
      // the browser's own and the polyfill in the browser; "—" where there's no Temporal of its own.
      const rows = await p.$$eval("tr[data-row]", (rs) =>
        rs.map((r) => ({
          row: (r as HTMLElement).dataset.row,
          results: [...r.querySelectorAll("[data-side]")].map(
            (c) => [(c as HTMLElement).dataset.side, c.textContent] as const,
          ),
        })),
      );
      expect(rows.length).toBeGreaterThan(20);
      const differs = rows.flatMap(({ row, results }) =>
        results
          .filter(([, text]) => text !== "—" && text !== results[0]![1])
          .map(([side, text]) => `${row} ${side}: ${text} (Worker: ${results[0]![1]})`),
      );
      const has = (side: string) =>
        !rows.some((r) => r.results.some(([s, t]) => s === side && t === "—"));
      console.log(
        `${e.name}: Cloudflare's own Temporal ${has("worker-own") ? "yes" : "no"}, the browser's own ${has("own") ? "yes" : "no"}`,
      );
      expect(differs).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
