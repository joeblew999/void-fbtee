// The English strings every language is tested on (e2e/dev/translator.test.ts): what an app's
// catalog holds, with each thing a translation can get wrong. Each entry is as `vp dev` sends a new
// one: its description, and its source lines (a plural has one line per form, each the source text
// as fbtee's prepare writes it). Add a string when Void's AI gets a new kind of thing wrong.

export interface TestString {
  /** What it tests, for the report. */
  name: string;
  description: string;
  lines: { text: string; variations: Record<string, number> }[];
  /** A count: the test gives it one line per plural form of the language (formsFor). */
  plural?: boolean;
  /**
   * Reference translations, by locale, for the score (score.ts chrF): one line per form for a count,
   * in the order zero, one, two, few, many, other (formsFor). Written by Claude Code on 2026-11-15 in the style of
   * the example's catalogs, not yet reviewed by a native speaker: replace one when someone who
   * reads the language corrects it.
   */
  ref?: Record<string, string[]>;
}

const one = (
  name: string,
  description: string,
  text: string,
  ref?: Record<string, string[]>,
): TestString => ({ name, description, lines: [{ text, variations: {} }], ref });

/** fbtee's plural form codes, by Intl's plural category (catalogs.ts, plurals.ts). */
const CODES: Record<string, number> = { zero: 16, one: 4, two: 8, few: 20, many: 12, other: 24 };
/** A count's lines for a language: one per form it uses, as fbtee's prepare writes them. */
export const formsFor = (locale: string, text: string) => {
  const has = new Intl.PluralRules(locale).resolvedOptions().pluralCategories as string[];
  return Object.keys(CODES)
    .filter((c) => has.includes(c))
    .map((c) => ({ text, variations: { "0": CODES[c]! } }));
};
const plural = (
  name: string,
  description: string,
  text: string,
  ref?: Record<string, string[]>,
): TestString => ({
  name,
  description,
  lines: [{ text, variations: { "0": 24 } }],
  plural: true,
  ref,
});

export const STRINGS: TestString[] = [
  one("a label", "Button that saves the event the person is editing", "Save", {
    "th-TH": ["บันทึก"],
    "ar-EG": ["حفظ"],
  }),
  one(
    "a sentence",
    "Line under the form, telling the person what happens after they post",
    "Your event shows in every language once it's posted.",
    {
      "th-TH": ["อีเวนต์ของคุณจะแสดงในทุกภาษาเมื่อโพสต์แล้ว"],
      "ar-EG": ["تظهر فعاليتك بكل اللغات بمجرد نشرها."],
    },
  ),
  one(
    "a placeholder",
    "Greeting at the top of an email, with the person's name",
    "Hello {name}, your ticket is attached.",
    { "th-TH": ["สวัสดี {name} ตั๋วของคุณแนบมาแล้ว"], "ar-EG": ["مرحبًا {name}، تذكرتك مرفقة."] },
  ),
  one(
    "two placeholders",
    "Progress line on the docs page: how many strings are translated",
    "{translated} of {total} strings translated",
    {
      "th-TH": ["แปลแล้ว {translated} จาก {total} ข้อความ"],
      "ar-EG": ["تُرجم {translated} من {total} نصًا"],
    },
  ),
  plural("a plural", "How many seats are left at an event", "{number} seats left", {
    "th-TH": ["เหลือ {number} ที่นั่ง"],
    "ar-EG": [
      "لم يتبقَّ أي مقعد",
      "تبقّى مقعد واحد",
      "تبقّى مقعدان",
      "تبقّت {number} مقاعد",
      "تبقّى {number} مقعدًا",
      "تبقّى {number} مقعد",
    ],
  }),
  one(
    "a command",
    "Docs line saying which command to run to start the dev server",
    "Run vp dev to start the app.",
    { "th-TH": ["รัน vp dev เพื่อเริ่มแอป"], "ar-EG": ["شغّل vp dev لبدء التطبيق."] },
  ),
  one(
    "a file name",
    "Docs line saying where the app's agent instructions are",
    "The app's AGENTS.md tells your coding agent what to do.",
    {
      "th-TH": ["AGENTS.md ของแอปบอกเอเจนต์เขียนโค้ดของคุณว่าต้องทำอะไร"],
      "ar-EG": ["يخبر ملف AGENTS.md في التطبيق وكيل البرمجة لديك بما يفعله."],
    },
  ),
  one(
    "a product name",
    "Docs line saying which tools translate the app",
    "Void's AI or Claude Code translates what's new.",
    {
      "th-TH": ["Void's AI หรือ Claude Code แปลสิ่งที่ใหม่"],
      "ar-EG": ["يترجم Void's AI أو Claude Code ما هو جديد."],
    },
  ),
  one(
    "a path",
    "Docs line saying where the catalogs are",
    "Each language's catalog is in i18n/translations.",
    {
      "th-TH": ["แค็ตตาล็อกของแต่ละภาษาอยู่ใน i18n/translations"],
      "ar-EG": ["فهرس كل لغة موجود في i18n/translations."],
    },
  ),
  one(
    "a question",
    "Heading of the page's last section, asking whether the reader is ready",
    "Ready to translate your app?",
    { "th-TH": ["พร้อมแปลแอปของคุณแล้วหรือยัง"], "ar-EG": ["هل أنت مستعد لترجمة تطبيقك؟"] },
  ),
];
