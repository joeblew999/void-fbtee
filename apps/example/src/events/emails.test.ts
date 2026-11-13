// The events' emails in their readers' languages, sent through Void's sendEmail and caught by Void's
// own test harness (void/email/testing, guide/email/sending.md "Testing"), which takes every send
// without faking the binding.
import { expect, test } from "vite-plus/test";
import { createEmailTestHarness } from "void/email/testing";
import {
  bookingEmail,
  cancellationEmail,
  linkEmail,
  reminderEmail,
  sendBookingEmail,
  sendCancellationEmail,
  sendLinkEmail,
  sendReminderEmail,
} from "./emails";

// The calligraphy evening as its organiser wrote it: Arabic, at 19:00 in Cairo on Monday 8 March.
const event = {
  title: "أمسية خط عربي",
  titleLocale: "ar-EG",
  startsAt: "2027-03-08T19:00:00+02:00[Africa/Cairo]",
} as const;
const booking = {
  ...event,
  name: "Laila",
  url: "https://example.com/th-TH/events/d57a8bf2-5909-4475-a407-12a879df5f01",
} as const;

test("the booking, in the booker's language, the time on the clock where it happens", async () => {
  const email = await bookingEmail({ ...booking, locale: "th-TH" });
  expect(email.subject).toBe("ที่นั่งของคุณใน أمسية خط عربي");
  expect(email.text).toContain("สวัสดี Laila");
  // Thai's own calendar and words for the date (8 March, a Monday), and Cairo's 19:00.
  expect(email.text).toMatch(/วันจันทร์.*มีนาคม.*19:00/);
  expect(email.text).toContain(booking.url);
});

test("the HTML in the email's own direction, the title in its own", async () => {
  const ar = await bookingEmail({ ...booking, locale: "ar-EG" });
  expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
  // And on the content too: Gmail drops <html>, <head> and <body>, keeping only what's inside.
  const content = ar.html.slice(ar.html.indexOf("<body"));
  expect(content).toMatch(
    /<table[^>]* lang="ar-EG" dir="rtl"|<table[^>]* dir="rtl"[^>]* lang="ar-EG"/,
  );
  const th = await bookingEmail({ ...booking, locale: "th-TH" });
  expect(th.html).toMatch(/<html dir="ltr" lang="th-TH">/);
  expect(th.html).toContain('<bdi lang="ar-EG" dir="rtl">أمسية خط عربي</bdi>');
});

test("in the site's look: its colours inlined, the link a button, nothing mail apps can't read", async () => {
  const email = await bookingEmail({ ...booking, locale: "en-US" });
  // The button: the line that introduced the link is its label, and it goes to the event's page.
  expect(email.html).toMatch(new RegExp(`<a href="${booking.url}"[^>]*background-color:rgb\\(`));
  expect(email.html).toContain("The event&#x27;s page</span>");
  // The site's card (--card in .dark, pages/style.css), as rgb: React Email turned its oklch.
  expect(email.html).toMatch(/background-color:rgb\(26,27,33\)/);
  for (const unread of ["oklch(", "var(", "class="]) expect(email.html).not.toContain(unread);
  // The site's logo, sent inside the email and shown from there.
  expect(email.html).toMatch(/<img[^>]*src="cid:logo"/);
  expect(email.attachments).toEqual([
    expect.objectContaining({ contentId: "logo", disposition: "inline", contentType: "image/png" }),
  ]);
  expect(email.attachments[0]!.content.subarray(1, 4)).toEqual(new TextEncoder().encode("PNG"));
  // The plain text is as before: the lines, then the link.
  expect(email.text).toContain("The event's page:");
  expect(email.text.trimEnd().endsWith(booking.url)).toBe(true);
});

test("the private link, in the poster's language, with the link as given", async () => {
  const link = "https://example.com/ar-EG/events/d57a8bf2-5909-4475-a407-12a879df5f01#key=abc";
  const ar = await linkEmail({ ...event, locale: "ar-EG", link });
  expect(ar.subject).toContain("أمسية خط عربي");
  expect(ar.subject).not.toContain("Your private link");
  expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
  expect(ar.text.trimEnd().endsWith(link)).toBe(true);
  // No line introduces it, so the HTML shows the link whole, the thing to keep.
  expect(ar.html).toContain(`>${link}</a>`);
  const en = await linkEmail({ ...event, locale: "en-US", link });
  expect(en.subject).toBe("Your private link for أمسية خط عربي");
  expect(en.text).toContain("the only way to delete your event later");
});

test("a cancellation, in the booker's language, linking to the events in it", async () => {
  const th = await cancellationEmail({
    ...event,
    locale: "th-TH",
    name: "Somchai",
    origin: "https://example.com",
  });
  expect(th.subject).toContain("أمسية خط عربي");
  expect(th.subject).not.toContain("cancelled");
  expect(th.text).toMatch(/วันจันทร์.*มีนาคม.*19:00/);
  expect(th.text.trimEnd().endsWith("https://example.com/th-TH/events")).toBe(true);
  const en = await cancellationEmail({
    ...event,
    locale: "en-US",
    name: "Somchai",
    origin: "https://example.com",
  });
  expect(en.subject).toBe("أمسية خط عربي is cancelled");
  expect(en.text).toContain("Hello Somchai,");
});

test("a reminder, in the booker's language, linking to the event on the site they booked on", async () => {
  const reminder = {
    ...event,
    name: "Laila",
    id: "d57a8bf2-5909-4475-a407-12a879df5f01",
    origin: "http://localhost:5173",
  } as const;
  const ar = await reminderEmail({ ...reminder, locale: "ar-EG" });
  expect(ar.subject).toBe("تذكير: أمسية خط عربي");
  expect(ar.html).toMatch(/<html dir="rtl" lang="ar-EG">/);
  expect(ar.text.trimEnd().endsWith(`http://localhost:5173/ar-EG/events/${reminder.id}`)).toBe(
    true,
  );
  const th = await reminderEmail({ ...reminder, locale: "th-TH" });
  expect(th.subject).toBe("แจ้งเตือน: أمسية خط عربي");
  expect(th.text).toMatch(/วันจันทร์.*มีนาคม.*19:00/);
});

test("each sent through Void's sendEmail", async () => {
  const inbox = createEmailTestHarness();
  try {
    await sendBookingEmail("laila@example.com", { ...booking, locale: "en-US" });
    await sendLinkEmail("poster@example.com", { ...event, locale: "en-US", link: "https://x.y/" });
    await sendCancellationEmail("laila@example.com", {
      ...event,
      locale: "en-US",
      name: "Laila",
      origin: "https://example.com",
    });
    await sendReminderEmail("laila@example.com", {
      ...event,
      locale: "en-US",
      name: "Laila",
      id: "d57a8bf2-5909-4475-a407-12a879df5f01",
      origin: "https://example.com",
    });
    expect(inbox.messages.map((m) => m.subject)).toEqual([
      "Your seat at أمسية خط عربي",
      "Your private link for أمسية خط عربي",
      "أمسية خط عربي is cancelled",
      "Reminder: أمسية خط عربي",
    ]);
  } finally {
    inbox.dispose();
  }
});
