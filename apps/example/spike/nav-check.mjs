// SPIKE: switching language with Void Link: client navigation keeps the old language; reloadDocument fixes it.
import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:5173";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
const p = await b.newPage();
const errs = [];
let loads = 0;
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", (e) => errs.push(String(e)));
p.on("load", () => loads++);
await p.goto(base + "/th-TH/stream", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const state = () =>
  p.evaluate(() => ({
    url: location.pathname,
    lang: document.documentElement.lang,
    title: document.querySelector("[data-testid=title]")?.textContent,
    streamed: document.querySelector("[data-testid=streamed]")?.textContent,
  }));
console.log("before:", JSON.stringify(await state()));
await p.click("[data-testid=to-de]");
await p.waitForTimeout(2500);
console.log("after: ", JSON.stringify(await state()), "full page loads:", loads, "errors:", errs);
await b.close();
