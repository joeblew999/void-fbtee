// What a request read that isn't in the reader's language yet (plans/translated-content.md): the
// read helpers (content.ts textOf) note it, and the middleware, once the page is rendered, keeps
// that response out of Void's page cache and queues the translation. Kept apart from content.ts,
// which imports void/db and void/queues, so the middleware of an app without content imports
// neither.
import { AsyncLocalStorage } from "node:async_hooks";

/** One row of content missing a translation: its table and id. */
export interface Pending {
  table: string;
  id: string;
}

const store = new AsyncLocalStorage<Map<string, Pending>>();

/** Runs a request with a fresh list of what it found missing (the middleware). */
export function withPending<T>(fn: () => T): { result: T; pending: () => Array<Pending> } {
  const found = new Map<string, Pending>();
  const result = store.run(found, fn);
  return { result, pending: () => [...found.values()] };
}

/** Notes a row the reader's language is missing for; outside a request, nothing. */
export function notePending(table: string, id: string): void {
  store.getStore()?.set(`${table} ${id}`, { table, id });
}
