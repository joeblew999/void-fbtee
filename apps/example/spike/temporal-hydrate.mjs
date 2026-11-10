// SPIKE: Temporal values must read the same before and after hydration, with the browser's
// native Temporal (Chrome) and without it (what Safari users get: the polyfill's own code).
import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:5173";
const ids = ["booking", "birthday", "length", "relative"];
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
let failed = 0;
for (const mode of ["native", "no-native"]) {
  for (const locale of ["th-TH", "de-DE", "ar-EG", "pl-PL"]) {
    const p = await b.newPage();
    const errors = [];
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.addInitScript((m) => {
      if (m === "no-native") delete globalThis.Temporal;
      window.__seen = {};
      new MutationObserver(() =>
        document.querySelectorAll("[data-testid]").forEach((el) => {
          (window.__seen[el.dataset.testid] ??= new Set()).add(el.textContent);
        }),
      ).observe(document, { subtree: true, childList: true, characterData: true });
    }, mode);
    const html = await (await fetch(`${base}/${locale}/time`)).text();
    const server = Object.fromEntries(
      ids.map((k) => [k, html.match(new RegExp(`data-testid="${k}">([^<]*)`))?.[1]]),
    );
    await p.goto(`${base}/${locale}/time`, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    const seen = await p.evaluate(() =>
      Object.fromEntries(Object.entries(window.__seen).map(([k, v]) => [k, [...v]])),
    );
    const engine = await p.evaluate(() =>
      typeof globalThis.Temporal === "undefined" ? "polyfill" : "native",
    );
    const problems = [];
    for (const k of ids) {
      const other = (seen[k] ?? []).filter((v) => v !== server[k]);
      if (other.length)
        problems.push(`${k}: server "${server[k]}" but browser showed ${JSON.stringify(other)}`);
    }
    if (errors.length) problems.push("errors: " + errors.join(" | "));
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${mode.padEnd(9)} browser=${engine.padEnd(8)} ${locale}` +
        (problems.length ? "\n   - " + problems.join("\n   - ") : ""),
    );
    failed += problems.length ? 1 : 0;
    await p.close();
  }
}
await b.close();
process.exit(failed ? 1 : 0);
