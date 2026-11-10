import { chromium } from "@playwright/test";
import { battery } from "./intl-battery.mjs";
const base = process.env.BASE ?? "http://localhost:5173";
const worker = await (await fetch(base + "/api/intl")).json();
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const p = await b.newPage();
await p.goto(base + "/en-US");
const chrome = await p.evaluate(`(${battery.toString()})()`);
const node = battery();
await b.close();
let diff = 0, total = 0;
const walk = (w, c, n, path) => {
  if (typeof w === "object") { for (const k of Object.keys(w)) walk(w[k], c?.[k], n?.[k], path + "." + k); return; }
  total++;
  if (w !== c) { diff++; console.log(`DIFF ${path}\n   workerd: ${w}\n   chrome:  ${c}\n   node:    ${n}`); }
};
walk(worker, chrome, node, "");
console.log(`\n${total - diff}/${total} identical (workerd vs Chrome ${b.version?.() ?? ""})`);
console.log("sample th-TH:", JSON.stringify(worker["th-TH"], null, 1));
console.log("thai calendar:", worker["th-TH-u-ca-buddhist-nu-thai"].date, "|", worker["th-TH-u-ca-buddhist-nu-thai"].num);
console.log("segmentThai:", worker.segmentThai, "| supported:", worker.supported, "| tz:", worker.defaultTZ, "| locale:", worker.defaultLocale);
