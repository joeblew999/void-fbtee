// SPIKE: compile catalogs in-process (what the plugin would do) and compare with the CLI output.
import fs from "node:fs";
import { collectBatchSync, translateSync } from "@nkzw/fbtee-compiler";
const files = ["pages/[lang]/index.tsx", "pages/[lang]/stream.tsx"].map((f) => ({
  filename: f,
  sourceText: fs.readFileSync(f, "utf8"),
}));
const collected = collectBatchSync(files, { lang: "tsx", collectPackager: "text" });
if (collected.errors.length) throw new Error(JSON.stringify(collected.errors));
const source = JSON.parse(collected.output);
const groups = ["th-TH", "de-DE"].map((l) =>
  JSON.parse(fs.readFileSync(`i18n/translations-src/${l}.json`, "utf8")),
);
const out = JSON.parse(
  translateSync(JSON.stringify({ phrases: source.phrases, translationGroups: groups }), true),
);
for (const l of ["th-TH", "de-DE"]) {
  const cli = JSON.parse(fs.readFileSync(`i18n/translations/${l}.json`, "utf8"));
  const sort = (o) =>
    JSON.stringify(o, (k, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
        : v,
    );
  const same = sort(cli[l]) === sort(out[l]);
  console.log(
    l,
    same ? "same as CLI" : "DIFFERENT",
    same ? "" : JSON.stringify(out[l]).slice(0, 300),
  );
}
console.log("keys:", Object.keys(out));
