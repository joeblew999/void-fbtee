// Where this Worker's database reads are answered, and how long they take: the check behind
// plans/reliable-work.md, which reads through primaryDb() (src/db.ts). D1 says, with every
// query's result, which copy answered it (`served_by_primary`, `served_by_region`; Cloudflare's D1
// read replication docs, "Observability"); they're absent locally, where there's one database.
//
// Two sessions, three reads each of one small query: one started on the main copy (`first-primary`,
// as the app reads), one allowed to start on a replica (`first-unconstrained`, Void's default), to
// compare. Under /api, so Void never caches it. It reads nothing anyone posted: a constant.
import { defineHandler } from "void";
import { createDb } from "void/db";
import { env } from "cloudflare:workers";
import { timedRead } from "../../src/events/store";

async function reads(session: "first-primary" | "first-unconstrained") {
  const db = createDb(env.DB, { session });
  const out = [];
  for (let i = 0; i < 3; i++) {
    out.push(await timedRead(db));
  }
  return out;
}

export const GET = defineHandler(async (c) => {
  const cf = c.req.raw.cf;
  return c.json({
    // The Cloudflare data centre that ran this request, and the visitor's country.
    worker: { colo: cf?.colo ?? null, country: cf?.country ?? null },
    "first-primary": await reads("first-primary"),
    "first-unconstrained": await reads("first-unconstrained"),
  });
});
