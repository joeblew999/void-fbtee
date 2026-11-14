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
  deleteEvent,
  deleteInPage,
  emailTo,
  keptTickets,
  postEvent,
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

/** Waits for the open page's title to be in Thai script: Workers AI's translation, any wording. */
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
  "a new post is translated by Workers AI, live; booking it in Thai emails a Thai confirmation with that title and its PDF ticket",
  async () => {
    const p = await page();
    const event = await postEvent(p, {
      title: "Cooking class by the sea",
      local: "2027-01-20T18:00",
    });
    posted.push(event);
    // The Thai page, open while the queue translates: its title turns Thai when the translation
    // lands (the page's live stream), whatever Workers AI wrote.
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
    // Their PDF tickets are gone too, even one the ticket queue was still printing when the event
    // was deleted: each has its booker's name on it.
    const left = async () =>
      (await keptTickets()).filter((k) => ticketIds.some((id) => k.includes(id)));
    await expect.poll(left, { timeout: 15_000 }).toEqual([]);
  },
);
