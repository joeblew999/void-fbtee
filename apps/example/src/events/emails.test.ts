// The events' emails in their readers' languages, sent through Void's sendEmail and caught by Void's
// own test harness (void/email/testing, guide/email/sending.md "Testing"), which takes every send
// without faking the binding.
import { expect, test } from "vite-plus/test";
import { createEmailTestHarness } from "void/email/testing";
import {
  bookingEmail,
  cancellationEmail,
  linkEmail,
  sendBookingEmail,
  sendCancellationEmail,
  sendLinkEmail,
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
  expect(ar.html).toMatch(/^<div lang="ar-EG" dir="rtl">/);
  const th = await bookingEmail({ ...booking, locale: "th-TH" });
  expect(th.html).toMatch(/^<div lang="th-TH" dir="ltr">/);
  expect(th.html).toContain('<bdi lang="ar-EG" dir="rtl">أمسية خط عربي</bdi>');
});

test("the private link, in the poster's language, with the link as given", async () => {
  const link = "https://example.com/ar-EG/events/d57a8bf2-5909-4475-a407-12a879df5f01#key=abc";
  const ar = await linkEmail({ ...event, locale: "ar-EG", link });
  expect(ar.subject).toContain("أمسية خط عربي");
  expect(ar.subject).not.toContain("Your private link");
  expect(ar.html).toMatch(/^<div lang="ar-EG" dir="rtl">/);
  expect(ar.text.trimEnd().endsWith(link)).toBe(true);
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
    expect(inbox.messages.map((m) => m.subject)).toEqual([
      "Your seat at أمسية خط عربي",
      "Your private link for أمسية خط عربي",
      "أمسية خط عربي is cancelled",
    ]);
  } finally {
    inbox.dispose();
  }
});
