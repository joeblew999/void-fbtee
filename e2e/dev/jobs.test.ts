// Dev server: the jobs and queues, run with Void's own triggers (guide/jobs.md, guide/queues.md):
// the reminder cron through `POST /__void/scheduled`, and each queue's consumer on its own through
// `POST /__void/queue`, its decision for the message (ack or retry) checked as Void reports it. The
// emails they send are read back from Void's dev inbox.
//
// Every event posted here is deleted at the end: the dev server's database is the developer's.
import { afterAll, expect, inject, test } from "vite-plus/test";
import {
  address,
  book,
  browser,
  deleteEvent,
  emailsTo,
  emailTo,
  postEvent,
  runCron,
  runQueue,
  started,
  url,
  type Posted,
} from "../helpers";

const page = browser("prod");
const skip = inject("devSkip" as never) as string;
const site = url("prod");
const posted: Posted[] = [];
// The reminder job's schedule (apps/example/crons/reminders.ts).
const DAILY = "0 6 * * *";

afterAll(async () => {
  for (const event of posted) await deleteEvent(event);
});

test.skipIf(!!skip)(
  "the reminder cron: each booker reminded in their language, linking here; a run a day later sends none",
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
    await book(arabic, "Laila", laila);

    // Run as if 12 hours before it starts: it's in the next 24 hours.
    const before = start.getTime() - 12 * 60 * 60 * 1000;
    await runCron(DAILY, before);
    const th = await emailTo(somchai, /^แจ้งเตือน: /);
    expect(th.text).toContain(`${site}/th-TH${event.path}`);
    const ar = await emailTo(laila, /^تذكير: /);
    expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
    expect(ar.text).toContain(`${site}/ar-EG${event.path}`);

    // The next day's run: the event has started by then, so no second reminder.
    await runCron(DAILY, before + 24 * 60 * 60 * 1000);
    const reminders = async (to: string, subject: RegExp) =>
      (await emailsTo(to)).filter((m) => subject.test(m.subject)).length;
    expect(await reminders(somchai, /^แจ้งเตือน: /)).toBe(1);
    expect(await reminders(laila, /^تذكير: /)).toBe(1);
  },
);

test.skipIf(!!skip)(
  "the cancellation queue on its own: the message is acked and its email sent, in its language",
  async () => {
    const to = address("laila");
    const action = await runQueue("cancel", {
      to,
      name: "Laila",
      locale: "ar-EG",
      title: "أمسية خط عربي",
      titleLocale: "ar-EG",
      startsAt: "2027-03-08T19:00:00+02:00[Africa/Cairo]",
      origin: site,
    });
    expect(action).toBe("ack");
    const mail = await emailTo(to, /^تم إلغاء /);
    expect(mail.subject).toBe("تم إلغاء أمسية خط عربي");
    expect(mail.text).toContain(`${site}/ar-EG/events`);
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
    expect(await runQueue("translate", { eventId: event.id })).toBe("ack");
    await thai.reload();
    await started(thai);
    expect(await thai.locator("h1").textContent()).toBe(title);
    expect(await runQueue("translate", { eventId: crypto.randomUUID() })).toBe("ack");
  },
);
