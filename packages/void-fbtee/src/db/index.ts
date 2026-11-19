// `void-fbtee/db`: the database, read from its main copy (plans/reliable-work.md).
//
// Void starts every request's, queue job's, cron's and page rebuild's session with
// `first-unconstrained`, so its first read may come from a replica that hasn't caught up
// (Void 1.8.0 and 1.10.0, `dist/runtime/db.mjs`; D1's replicas "may be arbitrarily out of date",
// Cloudflare's D1 read replication docs, checked 2026-11-18). A job started a second after a
// write would then decide on the database from before it. `first-primary` sends a session's
// first query to the main copy; later ones may use a replica, never one behind the first
// (Void's `guide/database/d1.md`, "Read replication").
//
// So everything that decides what to do, or builds a page the cache keeps, reads through this:
// one per handler, so its reads agree with each other. Writes go to the main copy either way.
import { createDb } from "void/db";
import { env } from "void/env";

/**
 * A database session that starts on D1's main copy: Void's `createDb` with `first-primary`. Typed
 * as `createDb`'s own result, not spelled out: in an app, `void/db` is Void's generated
 * `.void/db.d.ts`, whose `createDb` returns the app's schema (`DrizzleD1Database<typeof schema>`),
 * so this does too, and follows the schema as it changes.
 */
export function primaryDb(): ReturnType<typeof createDb> {
  return createDb((env as unknown as { DB: Parameters<typeof createDb>[0] }).DB, {
    session: "first-primary",
  });
}

/** A database session, as primaryDb() gives one: pass it on, so a handler's reads share it. */
export type Db = ReturnType<typeof createDb>;
