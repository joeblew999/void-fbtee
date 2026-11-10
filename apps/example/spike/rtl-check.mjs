// SPIKE: shadcn + Tailwind under RTL (ar-EG): dir, logical margin, styles, no errors.
import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:5173";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const p = await b.newPage();
const errs = [];
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(base + "/ar-EG/stream", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const btn = document.querySelector("[data-testid=btn]");
  const cs = getComputedStyle(btn);
  return {
    dir: document.documentElement.dir,
    marginRight: cs.marginRight,
    marginLeft: cs.marginLeft,
    bg: cs.backgroundColor,
    streamed: document.querySelector("[data-testid=streamed]")?.textContent,
  };
});
console.log(JSON.stringify(r), "errors:", errs);
await b.close();
