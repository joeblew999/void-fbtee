// Dev server: the events flows whose subject is an email or AI, checked through Void's dev hooks
// (e2e/dev/setup.ts). Every email is read back from Void's dev inbox: who it went to, its language,
// and that its links lead back to this dev server, where it was sent from. The other events tests
// run on the production build (e2e/preview/events.test.ts).
//
// Every event posted here is deleted at the end: the dev server's database is the developer's.
import { afterAll, expect, inject, test } from "vite-plus/test";
import {
  address,
  book,
  browser,
  changeEvent,
  dbRows,
  deleteEvent,
  deleteInPage,
  emailsTo,
  emailTo,
  keptTickets,
  postEvent,
  runCron,
  runQueue,
  seeText,
  started,
  url,
  type Posted,
} from "../helpers";

const page = browser("prod");
const skip = inject("devSkip" as never) as string;
const site = url("prod");
const posted: Posted[] = [];

afterAll(async () => {
  for (const event of posted) await deleteEvent(event);
});

/** An event's stored translations: language, fields, and the fingerprint each was made from. */
const translationsOf = (id: string) =>
  dbRows(
    "SELECT locale, fields, translated_by, translated_from, usage FROM events_translations WHERE source_id = ?",
    [id],
  );

/** Waits for the event's translations into both other languages, made from what it says now. */
const translatedNow = async (id: string, from?: unknown) => {
  const done = async () =>
    (await translationsOf(id)).filter(
      (r) =>
        r.translated_by === "google/gemini-4-hydrogen" && (!from || r.translated_from !== from),
    ).length;
  await expect.poll(done, { timeout: 60_000 }).toBe(2);
  return translationsOf(id);
};

/** Waits for the open page's title to be in Thai script: Void's AI's translation, any wording. */
const thaiTitle = (p: import("playwright").Page) =>
  p.waitForFunction(() => /[฀-๿]/.test(document.querySelector("h1")?.textContent ?? ""));

test.skipIf(!!skip)(
  "posting with 'email me my link': the link, in the poster's language, opens the event here with Delete",
  async () => {
    const p = await page();
    const to = address("poster");
    const event = await postEvent(p, {
      title: "Link email check",
      local: "2027-01-20T18:00",
      email: to,
    });
    posted.push(event);
    const mail = await emailTo(to, /^Your private link for /);
    expect(mail.subject).toBe("Your private link for Link email check");
    const link = new RegExp(`${site}/en-US${event.path}#key=${event.key}`);
    expect(mail.text).toMatch(link);
    // The link opens the event on this dev server, with the Delete box.
    const other = await page();
    await other.goto(`/en-US${event.path}#key=${event.key}`);
    await started(other);
    await other.getByTestId("delete").waitFor();
  },
);

test.skipIf(!!skip)(
  "a new post is translated by Void's AI, live; booking it in Thai emails a Thai confirmation with that title and its PDF ticket",
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Cooking class by the sea",
      local: "2027-01-20T18:00",
    });
    posted.push(event);
    // The Thai page, open while the queue translates: its title turns Thai when the translation
    // lands (the page's live stream), whatever Void's AI wrote.
    const thai = await page();
    await thai.goto(`/th-TH${event.path}`);
    await started(thai);
    await thaiTitle(thai);
    const title = (await thai.locator("h1").textContent())!;
    const to = address("somchai");
    await book(thai, "Somchai", to);
    const mail = await emailTo(to, /^ที่นั่งของคุณใน /);
    expect(mail.subject).toBe(`ที่นั่งของคุณใน ${title}`);
    expect(mail.text).toContain("สวัสดี Somchai");
    expect(mail.html).toMatch(/<html dir="ltr" lang="th-TH">/);
    expect(mail.text).toContain(`${site}/th-TH${event.path}`);
    // Its PDF ticket, printed by Cloudflare Browser Run through the ticket queue, attached; and the
    // same ticket from the page's download link.
    expect(mail.text).toContain("แนบตั๋วของคุณมาแล้ว");
    const pdf = mail.attachments.find((a) => a.filename === "ticket.pdf");
    expect(pdf?.mimeType).toBe("application/pdf");
    expect(new TextDecoder().decode(pdf!.content.slice(0, 5))).toBe("%PDF-");
    const href = await thai.getByTestId("ticket").getAttribute("href");
    const download = await fetch(site + href);
    expect(download.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(pdf!.content);
  },
);

test.skipIf(!!skip)(
  "the poster books their own event and keeps the link; deleting cancels each booking in its language, deletes their tickets and tells an open page",
  async () => {
    const p = await page();
    const poster = address("poster");
    const event = await postEvent(p, { title: "Cancellation check", local: "2027-01-20T18:00" });
    // Booking runs an action, after which Void writes the page's address without its "#key=…": the
    // browser's copy puts it back, and the Delete box stays.
    await book(p, "Poster", poster);
    await p.waitForURL(/#key=/);
    await p.getByTestId("delete").waitFor();
    // Someone else books in Arabic and keeps the page open.
    const other = await page();
    await other.goto(`/ar-EG${event.path}`);
    await started(other);
    const laila = address("laila");
    await book(other, "Laila", laila);
    const ticketIds = await Promise.all(
      [p, other].map(async (page) =>
        (await page.getByTestId("ticket").getAttribute("href"))!.replace("/tickets/", ""),
      ),
    );
    // Translated by now (Laila's page read it in Arabic): its rows are there, to see them go.
    await translatedNow(event.id);
    await deleteInPage(p);
    // The open Arabic page says so, with no reload.
    await seeText(other, "event-cancelled-text", "تم إلغاء هذه الفعالية.");
    expect(await other.getByTestId("book").count()).toBe(0);
    // Each booker's cancellation, through the queue, in the language they booked in, linking to
    // the events list here.
    const en = await emailTo(poster, / is cancelled$/);
    expect(en.text).toContain(`${site}/en-US/events`);
    const ar = await emailTo(laila, /^تم إلغاء /);
    expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
    expect(ar.text).toContain(`${site}/ar-EG/events`);
    // Each booking went after its email, and the event, with its translations (the foreign key's
    // cascade), with the last (plans/reliable-work.md); the daily job asks for nothing for it.
    await expect.poll(() => dbRows("SELECT id FROM events WHERE id = ?", [event.id])).toEqual([]);
    expect(await dbRows("SELECT id FROM bookings WHERE event_id = ?", [event.id])).toEqual([]);
    expect(await translationsOf(event.id)).toEqual([]);
    await runCron("17 4 * * *", Date.now());
    expect(await translationsOf(event.id)).toEqual([]);
    // Their PDF tickets are gone too, even one the ticket queue was still printing when the event
    // was deleted: each has its booker's name on it.
    const left = async () =>
      (await keptTickets()).filter((k) => ticketIds.some((id) => k.includes(id)));
    await expect.poll(left, { timeout: 15_000 }).toEqual([]);
  },
);

test.skipIf(!!skip)(
  "a post deleted before the queue gets to it: the queue acks it, and nothing is left",
  async () => {
    const p = await page();
    const event = await postEvent(p, { title: "Deleted at once", local: "2027-01-20T18:00" });
    expect(await deleteEvent(event)).toBe(true);
    expect(await runQueue("translate", { table: "events", id: event.id })).toBe("ack");
    // No translation, and no "queued" marker either.
    expect(await translationsOf(event.id)).toEqual([]);
  },
);

test.skipIf(!!skip)(
  "the poster changes the title and the time: translated again, an Arabic booker told in Arabic, the open page and the ticket follow",
  { timeout: 240_000 },
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Pottery for beginners",
      local: "2027-02-10T18:00",
      end: "2027-02-10T20:00",
    });
    posted.push(event);
    const before = await translatedNow(event.id);
    // Laila books in Arabic and keeps the page open.
    const other = await page();
    await other.goto(`/ar-EG${event.path}`);
    await started(other);
    const laila = address("laila");
    await book(other, "Laila", laila);
    const ticketId = (await other.getByTestId("ticket").getAttribute("href"))!.replace(
      "/tickets/",
      "",
    );
    await emailTo(laila, /./);
    // The poster changes it on the event's own page, with the key the page has.
    await p.getByTestId("change").click();
    await p.getByTestId("change-title-input").fill("Pottery for everyone");
    await p.getByTestId("change-local-input").fill("2027-02-10T19:00");
    await p.getByTestId("change-local-end-input").fill("2027-02-10T21:30");
    await p.getByTestId("change-save").click();
    await seeText(p, "event-title", "Pottery for everyone");
    // Translated again, from what it says now: a new fingerprint, and a new cost, in each language.
    const after = await translatedNow(event.id, before[0]!.translated_from);
    for (const row of after) expect(row.usage, String(row.locale)).toBeTruthy();
    const arabic = JSON.parse(String(after.find((r) => r.locale === "ar-EG")!.fields)) as {
      title: string;
    };
    // Laila's email, in Arabic, with the new Arabic title: sent when that translation was stored.
    const escaped = arabic.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mail = await emailTo(laila, new RegExp(escaped));
    expect(mail.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
    expect(mail.text).toContain(`${site}/ar-EG${event.path}`);
    // Her open page follows (the live "changed", then its translation), with no reload.
    await seeText(other, "event-title", arabic.title);
    // Her stored ticket, which showed the old time, is gone; the next download prints the new one.
    expect((await keptTickets()).some((k) => k.includes(ticketId))).toBe(false);
    const download = await fetch(`${site}/tickets/${ticketId}`);
    expect(download.headers.get("content-type")).toBe("application/pdf");
  },
);

test.skipIf(!!skip)(
  "a change to the description alone emails nobody, and is still translated again; a wrong key changes nothing",
  { timeout: 180_000 },
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Quiet reading hour",
      local: "2027-02-11T10:00",
      end: "2027-02-11T11:00",
    });
    posted.push(event);
    const before = await translatedNow(event.id);
    const somchai = address("somchai");
    await book(p, "Somchai", somchai);
    await emailTo(somchai, /./);
    const fields = {
      title: "Quiet reading hour",
      description: "Bring a book; tea is on us.",
      local: "2027-02-11T10:00",
      local_end: "2027-02-11T11:00",
      time_zone: "UTC",
      seats: 20,
    };
    // The time zone is the form's own: the browser's, which these tests run in.
    const [row] = await dbRows("SELECT starts_at FROM events WHERE id = ?", [event.id]);
    fields.time_zone = String(row!.starts_at).replace(/^.*\[(.*)\]$/, "$1");
    // Another event's key, or a made-up one: refused, and nothing changes.
    expect(await changeEvent(event, "not-the-key", fields)).toBe(403);
    const [still] = await dbRows("SELECT description FROM events WHERE id = ?", [event.id]);
    expect(still!.description).toBe("Posted by the tests.");
    // No seats at all: refused by the form's own check, Void's 422. (Fewer seats than are booked,
    // with more than one booked, is the action's own 409.)
    expect(await changeEvent(event, event.key, { ...fields, seats: 0 })).toBe(422);
    // The description alone, with the poster's key.
    expect([200, 204, 302]).toContain(await changeEvent(event, event.key, fields));
    await translatedNow(event.id, before[0]!.translated_from);
    // Nobody is told: the title, time and place are as they were.
    expect((await emailsTo(somchai)).filter((m) => / has changed$/.test(m.subject))).toEqual([]);
  },
);

test.skipIf(!!skip)(
  "a change of time alone needs no translation: the Arabic booker is told at once, in Arabic, and only once",
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Morning swim",
      local: "2027-02-12T07:00",
      end: "2027-02-12T08:00",
    });
    posted.push(event);
    const before = await translatedNow(event.id);
    const other = await page();
    await other.goto(`/ar-EG${event.path}`);
    await started(other);
    const laila = address("laila");
    await book(other, "Laila", laila);
    await emailTo(laila, /./);
    const [row] = await dbRows("SELECT starts_at FROM events WHERE id = ?", [event.id]);
    const fields = {
      title: "Morning swim",
      description: "Posted by the tests.",
      local: "2027-02-12T08:00",
      local_end: "2027-02-12T09:00",
      time_zone: String(row!.starts_at).replace(/^.*\[(.*)\]$/, "$1"),
      seats: 20,
    };
    expect([200, 204, 302]).toContain(await changeEvent(event, event.key, fields));
    // Told in Arabic, with the Arabic title already stored: no translation to wait for (its
    // fingerprint is the same), so within the queue's own time, not the translator's.
    const arabic = JSON.parse(String(before.find((r) => r.locale === "ar-EG")!.fields)) as {
      title: string;
    };
    // Her confirmation (with its ticket), then the change email, in Arabic, with the Arabic title.
    await expect.poll(async () => (await emailsTo(laila)).length, { timeout: 15_000 }).toBe(2);
    const mails = await emailsTo(laila);
    const mail = mails.find((m) => !m.attachments.some((a) => a.filename === "ticket.pdf"))!;
    expect(mail.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
    expect(mail.subject).toContain(arabic.title);
    // Not translated again: the same fingerprints as before the change.
    const fingerprints = (rows: Record<string, unknown>[]) =>
      new Set(rows.map((r) => String(r.translated_from)));
    expect(fingerprints(await translationsOf(event.id))).toEqual(fingerprints(before));
    // Nothing more comes for it: what she was told now matches the event.
    await new Promise((r) => setTimeout(r, 3000));
    expect((await emailsTo(laila)).length).toBe(2);
  },
);
