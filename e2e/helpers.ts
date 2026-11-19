// Browser helpers for the e2e tests: Playwright's library inside Vitest, as voidzero-dev/void
// does (test/browser-helpers.ts).
import {
  chromium,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright";
import PostalMime from "postal-mime";
import { afterAll, afterEach, beforeAll, expect, inject } from "vite-plus/test";
import { field, isRecord, isStringArray, textField } from "../packages/void-fbtee/src/guards";
import { got } from "./got";

declare global {
  interface Window {
    /** Every text each [data-testid] element has shown (watchTexts). */
    __seen?: Record<string, Set<string>>;
  }
}

/** A response's JSON, as unknown: each test reads it with the checked readers below. */
export const json = async (r: Response): Promise<unknown> => {
  const value: unknown = await r.json();
  return value;
};

/** A list in JSON, or the test stops. */
export function list(value: unknown, what = "a list"): Array<unknown> {
  if (!Array.isArray(value)) {
    throw new Error(`expected ${what}, got ${JSON.stringify(value)}`);
  }
  return value;
}

export const url = (mode: "prod") => inject(mode);

/**
 * Whether the suite runs against the live site (`vp run test:production`): tests that post or book
 * skip themselves there, since that would call Void's AI and send real email (Void's TESTING.md:
 * live tests are opt-in and leave nothing behind).
 */
export const onLiveSite = () => inject("live") === true;

/**
 * One browser per test file; each `page()` gets a fresh context, closed after its test. Chromium
 * unless asked for WebKit, Safari's engine (its own Intl and locale data). Playwright's own wait
 * limit (30 s), so a wait that never ends fails naming what it waited for.
 *
 * When a test fails, what its pages did is printed with the failure, as Void's browser suites
 * attach it (voidzero-dev/void TESTING.md): each page's recent console messages, page errors,
 * navigations and failed requests.
 */
export function browser(mode: "prod", engine: "chromium" | "webkit" = "chromium") {
  let b: Browser;
  const contexts: Array<BrowserContext> = [];
  const log: Array<string> = [];
  beforeAll(async () => {
    b = await (engine === "webkit" ? webkit : chromium).launch();
  });
  afterEach(async ({ task }) => {
    if (task.result?.state === "fail" && log.length) {
      console.error(`What the pages did in "${task.name}":\n${log.slice(-60).join("\n")}`);
    }
    log.length = 0;
    for (const c of contexts.splice(0)) {
      await c.close();
    }
  });
  afterAll(() => b?.close());
  return async (options: BrowserContextOptions = {}): Promise<Page> => {
    const context = await b.newContext({ baseURL: url(mode), ...options });
    context.on("page", (p) => watch(p, log));
    contexts.push(context);
    return context.newPage();
  };
}

/** The text of `[data-testid=id]`, once it's there. */
export async function text(page: Page, id: string) {
  const el = page.getByTestId(id);
  await el.waitFor();
  return el.textContent();
}

/**
 * Wait until the `nth` element matching `selector` has text that `is`, `has` or is `not` `want`
 * (hydration, live updates, an answer from the Worker). Playwright's wait, with no time limit.
 */
export async function untilText(
  page: Page,
  selector: string,
  kind: "is" | "has" | "not",
  want: string,
  nth = 0,
) {
  await page.waitForFunction(
    (arg) => {
      const text = document.querySelectorAll(arg.selector)[arg.nth]?.textContent;
      if (text == null) {
        return false;
      }
      return arg.kind === "is"
        ? text === arg.want
        : arg.kind === "has"
          ? text.includes(arg.want)
          : text !== arg.want;
    },
    { selector, kind, want, nth },
  );
}

/** Wait until `[data-testid=id]` shows `want`. */
export const seeText = (page: Page, id: string, want: string) =>
  untilText(page, `[data-testid="${id}"]`, "is", want);

/**
 * Wait until the page has started in the browser (the root layout's `<html data-hydrated>`), before
 * using a form or a link. Not `networkidle`, which voidzero-dev/void's TESTING.md says doesn't show
 * that the page is ready.
 */
export const started = (page: Page) =>
  page.locator('html[data-hydrated="true"]').waitFor({ state: "attached" });

/**
 * Wait for an island (by the end of its name; any island without one) to hydrate. Each island
 * hydrates on its own (void's waitForIslandsHydrated).
 */
export const hydrated = (page: Page, name: string, count: number) =>
  page.waitForFunction(
    ([name, count]) => {
      const islands = [...document.querySelectorAll<HTMLElement>(`[data-island$="${name}"]`)];
      return islands.length >= count && islands.every((i) => i.dataset.hydrated === "true");
    },
    [name, count] as const,
  );

/**
 * Records every text each `[data-testid]` element ever shows, from the first byte of HTML
 * until the test reads it, so a flash of untranslated text is caught even if it's fixed a
 * moment later. Call before page.goto.
 */
export async function watchTexts(page: Page) {
  await page.addInitScript(() => {
    const seen: Record<string, Set<string>> = {};
    window.__seen = seen;
    new MutationObserver(() =>
      document.querySelectorAll<HTMLElement>("[data-testid]").forEach((el) => {
        // Runs in the page: no imports there, so the id is checked inline.
        const id = el.dataset.testid;
        if (id !== undefined) {
          (seen[id] ??= new Set()).add(el.textContent ?? "");
        }
      }),
    ).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return (): Promise<Record<string, Array<string>>> =>
    page.evaluate(() =>
      Object.fromEntries(Object.entries(window.__seen ?? {}).map(([k, v]) => [k, [...v]])),
    );
}

/** Console errors and uncaught page errors. Call before page.goto. */
/** Keeps what a page does, for a failing test's report (browser()). */
function watch(page: Page, log: Array<string>) {
  page.on("console", (m) => log.push(`console.${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => log.push(`page error: ${String(e)}`));
  page.on("framenavigated", (f) => f === page.mainFrame() && log.push(`navigated: ${f.url()}`));
  page.on("requestfailed", (r) =>
    log.push(`failed: ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`),
  );
}

export function collectErrors(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

/**
 * Void cuts the server stream at the shell on defer() pages (readDeferredShell in @void/react's
 * pages-server), and React reports it (#419 in production). A fresh `void init` app with the
 * docs' own defer() example logs it too (void 1.7.0 and 1.8.0), so it's Void's and not ours:
 * expected on defer() pages and only there. Remove this once Void fixes it:
 * https://github.com/voidzero-dev/void/issues/809
 */
export const VOID_DEFER_MESSAGE = /Switched to client rendering|Minified React error #419/;

// Void's dev hooks, for the dev-server suite (e2e/dev/): its email inbox and its queue and cron
// triggers, each asking for the dev server's token (guide/email/sending.md, guide/queues.md,
// guide/jobs.md; e2e/dev/setup.ts provides it).

const hook = (path: string, init: { method?: string; body?: string } = {}) =>
  fetch(`${url("prod")}/__void/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-void-dev-trigger": got(inject("devToken"), "the dev server's trigger token"),
    },
  });

/** An email from Void's dev inbox, as postal-mime (Void's own parser) reads it. */
export type Mail = {
  to: Array<string>;
  subject: string;
  text: string;
  html: string;
  /** What it carries: the logo shown inside it, a PDF attached. */
  attachments: Array<{ filename: string; mimeType: string; content: Uint8Array }>;
};

/**
 * The emails Void's dev inbox holds for `to`, newest first. The inbox's page links each message;
 * its raw form (`/__void/inbox/<id>/raw`) is the email as sent.
 */
export async function emailsTo(to: string): Promise<Array<Mail>> {
  const page = await (await hook("inbox")).text();
  const ids = [
    ...new Set([...page.matchAll(/\/__void\/inbox\/([^/?"]+)\?/g)].map((m) => got(m[1]))),
  ];
  const mails: Array<Mail> = [];
  for (const id of ids) {
    const raw = await (await hook(`inbox/${id}/raw`)).arrayBuffer();
    const email = await PostalMime.parse(raw);
    const mail = {
      to: (email.to ?? []).map((a) => a.address ?? ""),
      subject: email.subject ?? "",
      text: email.text ?? "",
      html: email.html ?? "",
      attachments: email.attachments.map((a) => ({
        filename: a.filename ?? "",
        mimeType: a.mimeType,
        content: new Uint8Array(
          typeof a.content === "string" ? new TextEncoder().encode(a.content) : a.content,
        ),
      })),
    };
    if (mail.to.includes(to)) {
      mails.push(mail);
    }
  }
  return mails;
}

/**
 * The email Void's dev inbox gets for `to` whose subject matches, once it's there: a queue or a job
 * sends it after the request that caused it has answered. Exactly one: a second would be a
 * duplicate. Vitest's own retrying wait (expect.poll), not a sleep. `timeout` for one that waits on
 * something first (a change of title is emailed once its translation is stored).
 */
export async function emailTo(to: string, subject: RegExp, timeout = 30_000): Promise<Mail> {
  const matching = async () => (await emailsTo(to)).filter((m) => subject.test(m.subject));
  await expect.poll(async () => (await matching()).length, { timeout }).toBe(1);
  return got((await matching())[0]);
}

/**
 * Rows from the dev server's database, read through the Cloudflare Vite plugin's local explorer
 * (`/cdn-cgi/local/explorer/api`, its D1 `raw` query), as keptTickets reads R2: each row as an
 * object by column name.
 */
export async function dbRows(
  sql: string,
  params: Array<unknown> = [],
): Promise<Array<Record<string, unknown>>> {
  const api = `${url("prod")}/cdn-cgi/local/explorer/api/d1/database`;
  const dbs = list(field(await json(await fetch(api)), "result"));
  expect(dbs, "the dev server's D1 databases").toHaveLength(1);
  const uuid = got(textField(dbs[0], "uuid"), "the D1 database's uuid");
  const r = await fetch(`${api}/${uuid}/raw`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const results = field(list(field(await json(r), "result"))[0], "results");
  const columns = field(results, "columns");
  if (!isStringArray(columns)) {
    throw new Error(`D1 gave no column names for ${sql}`);
  }
  return list(field(results, "rows")).map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, list(row)[i]])),
  );
}

/**
 * Runs one message through a queue's consumer with Void's queue trigger (`POST /__void/queue`), and
 * gives Void's decision for it: "ack", or "retry" when the consumer asked for it or threw.
 */
export async function runQueue(queue: string, body: unknown): Promise<string> {
  const r = await hook("queue", {
    method: "POST",
    body: JSON.stringify({
      queue,
      messages: [{ id: crypto.randomUUID(), timestamp: Date.now(), body, attempts: 1 }],
    }),
  });
  const decisions = field(await json(r), "decisions");
  const action = textField(Object.values(isRecord(decisions) ? decisions : {})[0], "action");
  return got(action, `Void's decision for the ${queue} message`);
}

/** Runs a cron job with Void's trigger (`POST /__void/scheduled`), as if at `scheduledTime`. */
export async function runCron(cron: string, scheduledTime: number) {
  const r = await hook("scheduled", {
    method: "POST",
    body: JSON.stringify({ cron, scheduledTime }),
  });
  if (!r.ok) {
    throw new Error(`/__void/scheduled answered ${r.status}: ${await r.text()}`);
  }
}

/** An event a test posted: its id, its private key, and its path without the language. */
export type Posted = { id: string; key: string; path: string };

/**
 * Posts an event through the app's form, as a visitor would, in `locale` (the source language if
 * not given), starting at `local` (the picker's "2027-01-20T18:00") on the browser's clock and
 * ending at `end` (two hours after the start if not given); with `email`, its private link is
 * emailed there.
 */
export async function postEvent(
  page: Page,
  {
    title,
    local,
    end = later(local, 2),
    email,
    seats,
    description = "Posted by the tests.",
    locale = "en-US",
  }: {
    title: string;
    local: string;
    end?: string;
    email?: string;
    seats?: number;
    description?: string;
    locale?: string;
  },
): Promise<Posted> {
  await page.goto(`/${locale}/events/new`);
  await started(page);
  await page.getByTestId("event-title-input").fill(title);
  await page.getByTestId("event-description-input").fill(description);
  await page.getByTestId("event-local-input").fill(local);
  await page.getByTestId("event-local-end-input").fill(end);
  if (seats) {
    await page.getByTestId("event-seats-input").fill(String(seats));
  }
  if (email) {
    await page.getByTestId("event-email-input").fill(email);
  }
  await page.getByTestId("event-post").click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}#key=/);
  const at = new URL(page.url());
  return {
    id: got(at.pathname.split("/").pop()),
    key: got(new URLSearchParams(at.hash.slice(1)).get("key")),
    path: at.pathname.replace(/^\/[^/]+/, ""),
  };
}

/** A picker's local time ("2027-01-20T18:00") `hours` later, on the same clock. */
export const later = (local: string, hours: number) =>
  new Date(Date.parse(`${local}:00Z`) + hours * 3_600_000).toISOString().slice(0, 16);

/**
 * Changes a posted event with a key, as its page's "Save the changes" does: the answer's status
 * (200 when changed, 403 with a wrong key, 409 with fewer seats than are booked).
 */
export async function changeEvent(
  { id }: Pick<Posted, "id">,
  key: string,
  fields: {
    title: string;
    description: string;
    venue?: string;
    local: string;
    local_end: string;
    time_zone: string;
    seats: number;
  },
): Promise<number> {
  const r = await fetch(`${url("prod")}/en-US/events/${id}?change`, {
    method: "POST",
    // From the site itself, as the page sends it (Void refuses page actions from elsewhere).
    headers: { "Content-Type": "application/json", "X-VoidPages": "true", origin: url("prod") },
    body: JSON.stringify({ ...fields, key }),
    redirect: "manual",
  });
  return r.status;
}

/** Deletes a posted event with its key, as its page's "Delete it for good" does; true if it was. */
export async function deleteEvent({ id, key }: Posted): Promise<boolean> {
  const r = await fetch(`${url("prod")}/en-US/events/${id}?delete`, {
    method: "POST",
    // From the site itself, as the page sends it (Void refuses page actions from elsewhere).
    headers: { "Content-Type": "application/json", "X-VoidPages": "true", origin: url("prod") },
    body: JSON.stringify({ key }),
    redirect: "manual",
  });
  return r.status === 302;
}

/** Asks the event's page to delete it ("Delete", then "Delete it for good"), as its poster does. */
export async function confirmDelete(page: Page) {
  await page.getByTestId("delete").click();
  await page.getByTestId("delete-sure").click();
}

/** Deletes the event from its page, with the key the page has, and waits for the events list. */
export async function deleteInPage(page: Page) {
  await confirmDelete(page);
  await page.waitForURL(/\/events$/);
}

/** Books a seat on the page's event, in the page's language. */
export async function book(
  page: Page,
  name: string,
  email: string,
  options: { ticketInReminder?: boolean } = {},
) {
  await page.getByTestId("book-name").fill(name);
  await page.getByTestId("book-email").fill(email);
  if (options.ticketInReminder) {
    await page.getByTestId("book-reminder-ticket").check();
  }
  await page.getByTestId("book").click();
  await page.getByTestId("booked").waitFor();
}

/**
 * The PDF tickets the dev server keeps in R2 (not the docs' samples), read through the Cloudflare
 * Vite plugin's local explorer (`/cdn-cgi/local/explorer/api`, which the dev server prints).
 */
export async function keptTickets(): Promise<Array<string>> {
  const api = `${url("prod")}/cdn-cgi/local/explorer/api/r2/buckets`;
  // The app's one bucket, under whatever name it has: the dev server takes the deployed bucket's
  // name from apps/example/void.lock.json ("void-fbtee-example-storage"), not "default".
  const buckets = list(field(field(await json(await fetch(api)), "result"), "buckets"));
  expect(buckets, "the dev server's R2 buckets").toHaveLength(1);
  const name = got(textField(buckets[0], "name"), "the R2 bucket's name");
  const r = await fetch(`${api}/${name}/objects?prefix=tickets/`);
  return list(field(await json(r), "result"))
    .map((o) => got(textField(o, "key"), "an R2 object's key"))
    .filter((k) => !k.startsWith("tickets/sample/"));
}

/** A fresh address, so a test reads only its own emails from the shared inbox. */
export const address = (who: string) => `${who}-${crypto.randomUUID().slice(0, 8)}@example.com`;
