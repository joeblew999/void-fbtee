// `vp run database:from [places]`: how the live site's database reads go for visitors in each
// place (plans/reliable-work.md). A request comes from wherever it's sent, so this sends it from
// other people's machines: Globalping's probes (globalping.io, jsDelivr's free, open-source
// network; 61 in Thailand on 2026-11-18; 250 tests an hour without an account). Each probe asks
// the live site's /api/database (apps/example/routes/api/database.ts), which reads D1 three times
// starting on its main copy (first-primary, as the app reads) and three times allowing a replica
// (first-unconstrained, Void's default), and says which copy answered each and how long it took.
//
// Places as Globalping's "magic" names, comma-separated: a country (TH), a city (Bangkok), a
// cloud region (aws-ap-southeast-1). Default: Thailand and Virginia (near the main copy, ENAM).
import { readFileSync } from "node:fs";
import { field, parseJson, textField } from "../packages/void-fbtee/src/guards";
import { PRODUCTION_URL } from "./production-url";

const API = "https://api.globalping.io/v1/measurements";
const PER_PLACE = 2;

/** One read as /api/database reports it: how long, which copy answered, and where. */
const readOf = (value: unknown) => {
  const ms = field(value, "ms");
  const primary = field(value, "primary");
  return {
    ms: typeof ms === "number" ? ms : undefined,
    primary: typeof primary === "boolean" ? primary : null,
    region: textField(value, "region") ?? null,
  };
};
type Read = ReturnType<typeof readOf>;
const readsOf = (value: unknown): Array<Read> => (Array.isArray(value) ? value.map(readOf) : []);
const number = (value: unknown) => (typeof value === "number" ? value : undefined);

const site = new URL(readFileSync(PRODUCTION_URL, "utf8").trim());
const places = (process.argv[2] ?? "TH,Virginia").split(",").map((p) => p.trim());

const started = await fetch(API, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    type: "http",
    target: site.host,
    locations: places.map((magic) => ({ magic, limit: PER_PLACE })),
    measurementOptions: {
      protocol: "HTTPS",
      request: { method: "GET", path: "/api/database" },
    },
  }),
});
if (!started.ok) {
  throw new Error(`Globalping answered ${started.status}: ${await started.text()}`);
}
const id = textField(parseJson(await started.text()), "id");
if (!id) {
  throw new Error("Globalping gave the measurement no id");
}

// Globalping runs the measurement and its result fills in; asked again until it says it's done.
let measurement: unknown;
do {
  await new Promise((r) => setTimeout(r, 2000));
  measurement = parseJson(await (await fetch(`${API}/${id}`)).text());
} while (textField(measurement, "status") === "in-progress");
const results = field(measurement, "results");

const reads = (rs: Array<Read>) =>
  rs
    .map(
      (r) =>
        `${r.ms} ms ${r.primary === null ? "?" : r.primary ? "main" : "replica"}${r.region ? ` ${r.region}` : ""}`,
    )
    .join(", ");

console.log(`database:from ${site.host}, Globalping measurement ${id}\n`);
for (const each of Array.isArray(results) ? results : []) {
  const probe = field(each, "probe");
  const result = field(each, "result");
  const body = textField(result, "rawBody") ?? "";
  console.log(
    `${textField(probe, "city")}, ${textField(probe, "country")} (${textField(probe, "network")}): HTTP ${number(field(result, "statusCode")) ?? "-"}, ${number(field(field(result, "timings"), "total")) ?? "-"} ms in all`,
  );
  try {
    const a = parseJson(body);
    console.log(`  ran in Cloudflare's ${textField(field(a, "worker"), "colo")} data centre`);
    console.log(`  main copy first (the app):   ${reads(readsOf(field(a, "first-primary")))}`);
    console.log(
      `  replica allowed (default):   ${reads(readsOf(field(a, "first-unconstrained")))}`,
    );
  } catch {
    console.log(`  no answer to read: ${body.slice(0, 120)}`);
  }
}
