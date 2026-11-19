// Dev server: the jobs and queues, run with Void's own triggers (guide/jobs.md, guide/queues.md):
// the reminder cron and the sweep through `POST /__void/scheduled`, and each queue's consumer on its own through
// `POST /__void/queue`, its decision for the message (ack or retry) checked as Void reports it. The
// emails they send are read back from Void's dev inbox.
//
// Every event posted here is deleted at the end: the dev server's database is the developer's.
import { afterAll, expect, inject, test } from "vite-plus/test";
import {
  address,
  book,
  browser,
  dbRows,
  deleteEvent,
  emailsTo,
  emailTo,
  keptTickets,
  postEvent,
  runCron,
  runQueue,
  started,
  url,
  type Posted,
} from "../helpers";
import { got } from "../got";
import { textField } from "../../packages/void-fbtee/src/guards";

const page = browser("prod");
const skip = inject("devSkip");
const site = url("prod");
const posted: Array<Posted> = [];
// The reminder job's schedule (apps/example/crons/reminders.ts), and the sweep's (crons/owed.ts).
const DAILY = "0 6 * * *";
const OWED = "*/15 * * * *";

afterAll(async () => {
  for (const event of posted) {
    await deleteEvent(event);
  }
});

test.skipIf(!!skip)(
  "the reminder cron: each booker reminded in their language, linking here, the ticket attached for whoever asked; a run a day later sends none; a week after it starts, the tickets are deleted",
  async () => {
    // An event three days from now at 18:00 UTC, posted from a browser on UTC.
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 3);
    start.setUTCHours(18, 0, 0, 0);
    const p = await page({ timezoneId: "UTC" });
    const event = await postEvent(p, {
      title: "Reminder check",
      local: start.toISOString().slice(0, 16),
    });
    posted.push(event);
    const thai = await page();
    await thai.goto(`/th-TH${event.path}`);
    await started(thai);
    const somchai = address("somchai");
    await book(thai, "Somchai", somchai);
    const arabic = await page();
    await arabic.goto(`/ar-EG${event.path}`);
    await started(arabic);
    const laila = address("laila");
    // Laila asks for her ticket with the reminder too; Somchai doesn't.
    await book(arabic, "Laila", laila, { ticketInReminder: true });

    // Run as if 12 hours before it starts: it's in the next 24 hours.
    const before = start.getTime() - 12 * 60 * 60 * 1000;
    await runCron(DAILY, before);
    const th = await emailTo(somchai, /^แจ้งเตือน: /);
    expect(th.text).toContain(`${site}/th-TH${event.path}`);
    const ar = await emailTo(laila, /^تذكير: /);
    expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
    expect(ar.text).toContain(`${site}/ar-EG${event.path}`);
    const isTicket = (a: { filename: string }) => a.filename === "ticket.pdf";
    expect(ar.attachments.find(isTicket)?.mimeType).toBe("application/pdf");
    expect(ar.text).toContain("تذكرتك مرفقة.");
    expect(th.attachments.some(isTicket)).toBe(false);

    // Laila's ticket is kept until a week after the event started; the run that day deletes it.
    const ticket = got(await arabic.getByTestId("ticket").getAttribute("href")).replace(
      "/tickets/",
      "",
    );
    const kept = async () => (await keptTickets()).some((k) => k.includes(ticket));
    expect(await kept()).toBe(true);
    await runCron(DAILY, start.getTime() + 7 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    expect(await kept()).toBe(false);

    // The next day's run: the event has started by then, so no second reminder.
    await runCron(DAILY, before + 24 * 60 * 60 * 1000);
    const reminders = async (to: string, subject: RegExp) =>
      (await emailsTo(to)).filter((m) => subject.test(m.subject)).length;
    expect(await reminders(somchai, /^แจ้งเตือน: /)).toBe(1);
    expect(await reminders(laila, /^تذكير: /)).toBe(1);
  },
);

test.skipIf(!!skip)(
  "the sweep: a lost confirmation, change email and cancellation are each found in the database and sent once; a queue message twice sends nothing more",
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Sweep check",
      local: "2027-01-21T18:00",
      end: "2027-01-21T20:00",
    });
    posted.push(event);
    const to = address("ana");
    await book(p, "Ana", to);
    await emailTo(to, /^Your seat at /);
    const bookingId = got(
      textField((await dbRows("SELECT id FROM bookings WHERE email = ?", [to]))[0], "id"),
      "Ana's booking",
    );
    const count = async (subject: RegExp) =>
      (await emailsTo(to)).filter((m) => subject.test(m.subject)).length;

    // A confirmation lost (as if the Worker died after booking, or the ticket queue's tries ran
    // out): owed, and older than 15 minutes. The sweep sends it, and records it.
    await dbRows(
      "UPDATE bookings SET confirmed_at = NULL, created_at = datetime('now', '-1 hour') WHERE id = ?",
      [bookingId],
    );
    await runCron(OWED, Date.now());
    await expect.poll(() => count(/^Your seat at /), { timeout: 30_000 }).toBe(2);
    await expect
      .poll(
        async () =>
          got((await dbRows("SELECT confirmed_at FROM bookings WHERE id = ?", [bookingId]))[0])
            .confirmed_at,
      )
      .toBeTruthy();

    // A change email lost: what Ana was told no longer matches the event, changed over 15 minutes
    // ago. The sweep sends it, saying what it was, and records what she's told now.
    await dbRows(
      "UPDATE bookings SET told_starts_at = '2027-01-21T17:00:00+00:00[UTC]' WHERE id = ?",
      [bookingId],
    );
    await dbRows("UPDATE events SET updated_at = datetime('now', '-1 hour') WHERE id = ?", [
      event.id,
    ]);
    await runCron(OWED, Date.now());
    await expect.poll(() => count(/ has changed$/), { timeout: 30_000 }).toBe(1);
    const [told] = await dbRows(
      "SELECT b.told_starts_at = e.starts_at AS same FROM bookings b JOIN events e ON e.id = b.event_id WHERE b.id = ?",
      [bookingId],
    );
    expect(got(told).same).toBe(1);
    // The change queue asked again (a message delivered twice): nothing owed, nothing sent.
    expect(await runQueue("change", { bookingId })).toBe("ack");
    expect(await count(/ has changed$/)).toBe(1);

    // A cancellation lost: the event cancelled over 15 minutes ago, its booking still there. The
    // sweep sends it; the booking, then the event with its last, go.
    await dbRows("UPDATE events SET cancelled_at = datetime('now', '-1 hour') WHERE id = ?", [
      event.id,
    ]);
    await runCron(OWED, Date.now());
    await expect.poll(() => count(/ is cancelled$/), { timeout: 30_000 }).toBe(1);
    await expect.poll(() => dbRows("SELECT id FROM events WHERE id = ?", [event.id])).toEqual([]);
    expect(await dbRows("SELECT id FROM bookings WHERE id = ?", [bookingId])).toEqual([]);
    expect(await runQueue("cancel", { bookingId })).toBe("ack");
    expect(await count(/ is cancelled$/)).toBe(1);
  },
);

test.skipIf(!!skip)(
  "the translate queue on its own: acked for a translated post and for one that's gone, changing nothing",
  async () => {
    const p = await page();
    const event = await postEvent(p, { title: "Queue check", local: "2027-01-20T18:00" });
    posted.push(event);
    // Posting sent it through the queue already; once the Thai page has its translation, a second
    // message finds nothing missing.
    const thai = await page();
    await thai.goto(`/th-TH${event.path}`);
    await started(thai);
    await thai.waitForFunction(() => /[฀-๿]/.test(document.querySelector("h1")?.textContent ?? ""));
    const title = await thai.locator("h1").textContent();
    expect(await runQueue("translate", { table: "events", id: event.id })).toBe("ack");
    await thai.reload();
    await started(thai);
    expect(await thai.locator("h1").textContent()).toBe(title);
    expect(await runQueue("translate", { table: "events", id: crypto.randomUUID() })).toBe("ack");
  },
);
