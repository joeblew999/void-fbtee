// The Strings page's "Every piece of fbtee" section (apps/example/src/docs/StringPieces.tsx), in the
// production build: each of fbtee's ways of writing a sentence in all three languages, from the
// first byte of HTML through hydration, with no other text in between. The expected words are the
// catalogs' (i18n/translations/), with fbtee's built-in list strings joining the menu.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, started, VOID_DEFER_MESSAGE, watchTexts } from "../helpers";
import { LOCALES } from "../locales";

const page = browser("prod");

// Each piece's lines, as the page shows them: one entry per <p>.
const PIECES: Record<string, Record<string, string[]>> = {
  "en-US": {
    list: ["The menu has Home, Events and Docs."],
    enum: ["Somchai takes part in person.", "Somchai takes part online."],
    // <fbt:name>: English words it the same way for her and him.
    name: ["Laila booked a seat.", "Somchai booked a seat."],
    pronoun: ["Laila checked her ticket.", "Laila checked their ticket."],
    "same-param": ["Laila booked, and Laila got the ticket by email."],
    reader: ["You're booked.", "You're booked.", "You're booked."],
    // The same line in the other languages, in the app's order; no gender given, so Arabic's
    // unknown form.
    "in-language": ["تم تأكيد حجزك.", "คุณจองแล้ว"],
  },
  "th-TH": {
    list: ["เมนูมี หน้าแรก กิจกรรม และเอกสาร"],
    enum: ["Somchai เข้าร่วมด้วยตัวเอง", "Somchai เข้าร่วมทางออนไลน์"],
    name: ["Laila จองที่นั่งแล้ว", "Somchai จองที่นั่งแล้ว"],
    pronoun: ["Laila ตรวจตั๋วของเธอแล้ว", "Laila ตรวจตั๋วของตนแล้ว"],
    "same-param": ["Laila จองแล้ว และ Laila ได้รับตั๋วทางอีเมล"],
    reader: ["คุณจองแล้ว", "คุณจองแล้ว", "คุณจองแล้ว"],
    "in-language": ["You're booked.", "تم تأكيد حجزك."],
  },
  "ar-EG": {
    list: ["تضم القائمة الرئيسية، الفعاليات والتوثيق."],
    enum: ["مشاركة Somchai: حضوريًا.", "مشاركة Somchai: عبر الإنترنت."],
    // Arabic's verb follows the person: حجزت for Laila, حجز for Somchai.
    name: ["حجزت Laila مقعدًا.", "حجز Somchai مقعدًا."],
    pronoun: ["تمّت مراجعة Laila لتذكرتها.", "تمّت مراجعة Laila لتذكرتهم."],
    "same-param": ["تم الحجز باسم Laila، ووصلت التذكرة إلى Laila بالبريد الإلكتروني."],
    // The reader's own gender, through <InLanguage gender>: male, female, not given.
    reader: ["أنت مسجَّل.", "أنتِ مسجَّلة.", "تم تأكيد حجزك."],
    "in-language": ["You're booked.", "คุณจองแล้ว"],
  },
};

for (const [locale, pieces] of Object.entries(PIECES))
  test(`${locale}: every piece of fbtee, kept through hydration`, async () => {
    const p = await page();
    const errors = collectErrors(p);
    const seen = await watchTexts(p);
    await p.goto(`/${locale}/docs/strings`);
    await started(p);
    for (const [id, lines] of Object.entries(pieces))
      expect(await p.getByTestId(`piece-${id}`).locator("p").allTextContents(), id).toEqual(lines);
    // Nothing else was ever shown in them, from the first byte of HTML on.
    const texts = await seen();
    for (const [id, lines] of Object.entries(pieces))
      expect(texts[`piece-${id}`], id).toEqual([lines.join("")]);
    // <InLanguage> marks its part with its own language; the page keeps the page's.
    expect(await p.locator("html").getAttribute("lang")).toBe(locale);
    const others = p.getByTestId("piece-in-language").locator("p > span");
    const langs = await others.evaluateAll((els) => els.map((el) => el.getAttribute("lang")));
    expect(langs).toEqual(LOCALES.filter((l) => l !== locale));
    expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
  });
