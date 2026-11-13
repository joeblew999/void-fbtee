// The booking email in the booker's language, sent through Void's sendEmail and caught by Void's own
// test harness (void/email/testing, guide/email/sending.md "Testing"), which takes every send
// without faking the binding.
import { expect, test } from "vite-plus/test";
import { createEmailTestHarness } from "void/email/testing";
import { bookingEmail, sendBookingEmail } from "./booking-email";

const booking = {
  name: "Laila",
  // The calligraphy evening as its organiser wrote it: Arabic, at 19:00 in Cairo.
  title: "أمسية خط عربي",
  titleLocale: "ar-EG",
  startsAt: "2027-03-08T19:00:00+02:00[Africa/Cairo]",
  url: "https://example.com/th-TH/events/d57a8bf2-5909-4475-a407-12a879df5f01",
} as const;

test("in the booker's language, the time on the clock where it happens", async () => {
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

test("sent through Void's sendEmail", async () => {
  const inbox = createEmailTestHarness();
  try {
    await sendBookingEmail("laila@example.com", { ...booking, locale: "en-US" });
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.messages[0]!.subject).toBe("Your seat at أمسية خط عربي");
  } finally {
    inbox.dispose();
  }
});
