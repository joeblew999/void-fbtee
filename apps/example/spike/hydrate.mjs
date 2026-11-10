// SPIKE: open each locale in real Chrome, record every text the title and
// streamed/deferred nodes ever show (to catch an English flash), and collect
// console errors (hydration mismatches).
import { chromium } from "@playwright/test";

const base = "http://localhost:5173";
const expect = {
  "en-US": { title: "Hello world", plural: "You booked 3 nights", deferred: "Deferred: 1 night left", streamed: "Streamed after the shell" },
  "th-TH": { title: "สวัสดีชาวโลก", plural: "คุณจองไว้ 3 คืน", deferred: "ภายหลัง: เหลืออีก 1 คืน", streamed: "ส่งตามมาหลังเชลล์" },
  "de-DE": { title: "Hallo Welt", plural: "Sie haben 3 Nächte gebucht", deferred: "Später: noch 1 Nacht", streamed: "Nach der Shell gestreamt" },
};
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
let failed = 0;
for (const [locale, want] of Object.entries(expect)) {
  for (const path of ["", "/stream"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      window.__seen = {};
      const rec = () => document.querySelectorAll("[data-testid]").forEach((el) => {
        const k = el.dataset.testid; (window.__seen[k] ??= new Set()).add(el.textContent);
      });
      new MutationObserver(rec).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto(base + "/" + locale + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const seen = await page.evaluate(() => Object.fromEntries(Object.entries(window.__seen).map(([k, v]) => [k, [...v]])));
    const hydrated = await page.evaluate(() => !!document.getElementById("app")?._reactRootContainer || Object.keys(document.getElementById("app") ?? {}).some((k) => k.startsWith("__reactContainer")));
    const keys = path ? ["title", "streamed"] : ["title", "plural", "deferred"];
    const problems = [];
    for (const k of keys) {
      const vals = (seen[k] ?? []).filter((v) => v !== "…");
      if (!vals.includes(want[k])) problems.push(`${k} never showed "${want[k]}" (saw ${JSON.stringify(vals)})`);
      const other = vals.filter((v) => v !== want[k]);
      if (other.length) problems.push(`${k} flashed ${JSON.stringify(other)}`);
    }
    if (!hydrated) problems.push("React root not found (not hydrated)");
    if (errors.length) problems.push("console errors: " + errors.join(" | "));
    console.log(`${problems.length ? "FAIL" : "ok  "} /${locale}${path}` + (problems.length ? "\n   - " + problems.join("\n   - ") : ""));
    failed += problems.length ? 1 : 0;
    await page.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
