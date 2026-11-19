// Where this Worker's database reads are answered, and how long they take: the check behind
// plans/reliable-work.md, which reads through primaryDb() (void-fbtee/db). D1 says, with every
// query's result, which copy answered it (`served_by_primary`, `served_by_region`; Cloudflare's D1
// read replication docs, "Observability"); they're absent locally, where there's one database.
//
// Two sessions, three reads each of one small query: one started on the main copy (`first-primary`,
// as the app reads), one allowed to start on a replica (`first-unconstrained`, Void's default), to
// compare. Under /api, so Void never caches it. It reads nothing anyone posted: a constant.
import { defineHandler } from "void";
import { createDb } from "void/db";
import { env } from "void/env";
import type { Db } from "void-fbtee/db";
import { timedRead } from "../../src/events/store";

async function reads(session: "first-primary" | "first-unconstrained") {
  // The app's createDb types its schema in; the store takes void-fbtee/db's plain session type.
  // The same D1 session either way.
  const db = createDb((env as unknown as { DB: Parameters<typeof createDb>[0] }).DB, {
    session,
  }) as unknown as Db;
  const out = [];
  for (let i = 0; i < 3; i++) out.push(await timedRead(db));
  return out;
}

export const GET = defineHandler(async (c) => {
  const cf = (c.req.raw as { cf?: { colo?: string; country?: string } }).cf;
  return c.json({
    // The Cloudflare data centre that ran this request, and the visitor's country.
    worker: { colo: cf?.colo ?? null, country: cf?.country ?? null },
    "first-primary": await reads("first-primary"),
    "first-unconstrained": await reads("first-unconstrained"),
  });
});
