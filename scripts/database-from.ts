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
import { PRODUCTION_URL } from "./production-url";

const API = "https://api.globalping.io/v1/measurements";
const PER_PLACE = 2;

type Read = { ms: number; primary: boolean | null; region: string | null };
type Answer = {
  worker: { colo: string | null; country: string | null };
  "first-primary": Read[];
  "first-unconstrained": Read[];
};

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
if (!started.ok) throw new Error(`Globalping answered ${started.status}: ${await started.text()}`);
const { id } = (await started.json()) as { id: string };

// Globalping runs the measurement and its result fills in; asked again until it says it's done.
type Measurement = {
  status: string;
  results: {
    probe: { country: string; city: string; network: string };
    result: { statusCode?: number; rawBody?: string; timings?: { total?: number } };
  }[];
};
let measurement: Measurement;
do {
  await new Promise((r) => setTimeout(r, 2000));
  measurement = (await (await fetch(`${API}/${id}`)).json()) as Measurement;
} while (measurement.status === "in-progress");

const reads = (rs: Read[]) =>
  rs
    .map(
      (r) =>
        `${r.ms} ms ${r.primary === null ? "?" : r.primary ? "main" : "replica"}${r.region ? ` ${r.region}` : ""}`,
    )
    .join(", ");

console.log(`database:from ${site.host}, Globalping measurement ${id}\n`);
for (const { probe, result } of measurement.results) {
  console.log(
    `${probe.city}, ${probe.country} (${probe.network}): HTTP ${result.statusCode ?? "-"}, ${result.timings?.total ?? "-"} ms in all`,
  );
  try {
    const a = JSON.parse(result.rawBody ?? "") as Answer;
    console.log(`  ran in Cloudflare's ${a.worker.colo} data centre`);
    console.log(`  main copy first (the app):   ${reads(a["first-primary"])}`);
    console.log(`  replica allowed (default):   ${reads(a["first-unconstrained"])}`);
  } catch {
    console.log(`  no answer to read: ${(result.rawBody ?? "").slice(0, 120)}`);
  }
}
