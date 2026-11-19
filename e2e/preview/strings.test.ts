// The Strings page's "Every piece of fbtee" section (apps/example/src/docs/StringPieces.tsx), in the
// production build: each of fbtee's ways of writing a sentence in all three languages, from the
// first byte of HTML through hydration, with no other text in between; then the form changed, and
// every piece following it. The expected words are the
// catalogs' (i18n/translations/), with fbtee's built-in list strings joining the menu.
import { expect, test } from "vite-plus/test";
import { browser, collectErrors, started, VOID_DEFER_MESSAGE, watchTexts } from "../helpers";
import { LOCALES } from "../locales";

const page = browser("prod");

// Each piece as the page first shows it (the form's defaults: Laila, female, 3 seats, in person,
// "and"): one entry per <p>.
const PIECES: Record<string, Record<string, Array<string>>> = {
  "en-US": {
    list: ["The menu has Home, Events and Docs."],
    enum: ["Laila takes part in person."],
    name: ["Laila booked a seat."],
    plural: ["Laila booked 3 seats."],
    pronoun: ["Laila checked her ticket."],
    "same-param": ["Laila booked, and Laila got the ticket by email."],
    reader: ["You're booked."],
    // The same line in the other languages, in the app's order, for a female reader.
    "in-language": ["أنتِ مسجَّلة.", "คุณจองแล้ว"],
  },
  "th-TH": {
    list: ["เมนูมี หน้าแรก กิจกรรม และเอกสาร"],
    enum: ["Laila เข้าร่วมด้วยตัวเอง"],
    name: ["Laila จองที่นั่งแล้ว"],
    plural: ["Laila จองที่นั่งแล้ว 3 ที่"],
    pronoun: ["Laila ตรวจตั๋วของเธอแล้ว"],
    "same-param": ["Laila จองแล้ว และ Laila ได้รับตั๋วทางอีเมล"],
    reader: ["คุณจองแล้ว"],
    "in-language": ["You're booked.", "أنتِ مسجَّلة."],
  },
  "ar-EG": {
    // fbtee joins all but the last item with one string, so Arabic keeps its comma (the skill).
    list: ["تضم القائمة الرئيسية، الفعاليات والتوثيق."],
    enum: ["مشاركة Laila: حضوريًا."],
    // Arabic's verb follows the person: حجزت for her.
    name: ["حجزت Laila مقعدًا."],
    plural: ["٣ مقاعد محجوزة باسم Laila."],
    pronoun: ["تمّت مراجعة Laila لتذكرتها."],
    "same-param": ["تم الحجز باسم Laila، ووصلت التذكرة إلى Laila بالبريد الإلكتروني."],
    reader: ["أنتِ مسجَّلة."],
    "in-language": ["You're booked.", "คุณจองแล้ว"],
  },
};

// After the form is changed (Somchai, male, online, "or"), and the count tried at 1, 0, 2 and 11.
const CHANGED: Record<string, Record<string, Array<string> | Record<number, string>>> = {
  "en-US": {
    plural: {
      1: "Somchai booked a seat.",
      0: "Somchai booked 0 seats.",
      2: "Somchai booked 2 seats.",
      11: "Somchai booked 11 seats.",
    },
    list: ["Open Home, Events or Docs?"],
    enum: ["Somchai takes part online."],
    name: ["Somchai booked a seat."],
    pronoun: ["Somchai checked his ticket."],
    "in-language": ["أنت مسجَّل.", "คุณจองแล้ว"],
  },
  "ar-EG": {
    // Each of Arabic's forms: exactly one, zero, two, and 11 ("many").
    plural: {
      1: "مقعد واحد محجوز باسم Somchai.",
      0: "لا مقاعد محجوزة باسم Somchai.",
      2: "مقعدان محجوزان باسم Somchai.",
      11: "١١ مقعدًا محجوزًا باسم Somchai.",
    },
    list: ["هل تفتح الرئيسية، الفعاليات أو التوثيق؟"],
    enum: ["مشاركة Somchai: عبر الإنترنت."],
    name: ["حجز Somchai مقعدًا."],
    pronoun: ["تمّت مراجعة Somchai لتذكرته."],
    reader: ["أنت مسجَّل."],
  },
  "th-TH": {
    plural: { 1: "Somchai จองที่นั่งแล้ว 1 ที่", 11: "Somchai จองที่นั่งแล้ว 11 ที่" },
    list: ["เปิด หน้าแรก กิจกรรม หรือ เอกสาร ไหม"],
    pronoun: ["Somchai ตรวจตั๋วของเขาแล้ว"],
    "in-language": ["You're booked.", "أنت مسجَّل."],
  },
};

for (const [locale, changed] of Object.entries(CHANGED)) {
  test(`${locale}: the form drives every piece, by the language's own rules`, async () => {
    const p = await page();
    const errors = collectErrors(p);
    await p.goto(`/${locale}/docs/strings`);
    await started(p);
    await p.getByTestId("try-name").fill("Somchai");
    await p.getByTestId("try-gender").selectOption("male");
    await p.getByTestId("try-way").selectOption("online");
    await p.getByTestId("try-conjunction").selectOption("or");
    const lines = (id: string) => p.getByTestId(`piece-${id}`).locator("p").allTextContents();
    for (const [id, want] of Object.entries(changed)) {
      if (Array.isArray(want)) {
        expect(await lines(id), id).toEqual(want);
        continue;
      }
      for (const [count, text] of Object.entries(want)) {
        await p.getByTestId("try-count").fill(count);
        expect(await lines(id), `${id} ${count}`).toEqual([text]);
      }
    }
    expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
  });
}

for (const [locale, pieces] of Object.entries(PIECES)) {
  test(`${locale}: every piece of fbtee, kept through hydration`, async () => {
    const p = await page();
    const errors = collectErrors(p);
    const seen = await watchTexts(p);
    await p.goto(`/${locale}/docs/strings`);
    await started(p);
    for (const [id, lines] of Object.entries(pieces)) {
      expect(await p.getByTestId(`piece-${id}`).locator("p").allTextContents(), id).toEqual(lines);
    }
    // Nothing else was ever shown in them, from the first byte of HTML on.
    const texts = await seen();
    for (const [id, lines] of Object.entries(pieces)) {
      expect(texts[`piece-${id}`], id).toEqual([lines.join("")]);
    }
    // <InLanguage> marks its part with its own language; the page keeps the page's.
    expect(await p.locator("html").getAttribute("lang")).toBe(locale);
    const others = p.getByTestId("piece-in-language").locator("p > span");
    const langs = await others.evaluateAll((els) => els.map((el) => el.getAttribute("lang")));
    expect(langs).toEqual(LOCALES.filter((l) => l !== locale));
    expect(errors.filter((e) => !VOID_DEFER_MESSAGE.test(e))).toEqual([]);
  });
}
