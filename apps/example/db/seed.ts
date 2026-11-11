// `void db seed`: the sample events, one per language, each on its own city's clock, with their
// text in the other languages (as queues/translate.ts would store it), so every page is in its own
// language and the tests don't call Workers AI. The tests start from these (e2e/setup.ts runs
// `void db seed --yes`). Dates are well ahead, so they stay "upcoming".
import { defineSeed } from "void/seed";
import { startsAt } from "./schema/events";

type Text = { title: string; description: string };

const SAMPLES: {
  local: string;
  zone: string;
  seats: number;
  locale: string;
  texts: Record<string, Text>;
}[] = [
  {
    local: "2027-03-06T18:30",
    zone: "Asia/Bangkok",
    seats: 20,
    locale: "th-TH",
    texts: {
      "th-TH": {
        title: "ตลาดนัดกลางคืน: เดินชิมอาหารริมทาง",
        description: "เดินชิมอาหารริมทางกับเพื่อนใหม่ ตั้งแต่ข้าวเหนียวมะม่วงไปจนถึงไก่ย่าง",
      },
      "en-US": {
        title: "Night market: a street food walk",
        description:
          "Taste your way through the street food with new friends, from mango sticky rice to grilled chicken.",
      },
      "ar-EG": {
        title: "السوق الليلي: جولة لتذوق طعام الشارع",
        description: "تذوّق طعام الشارع مع أصدقاء جدد، من الأرز اللزج بالمانجو إلى الدجاج المشوي.",
      },
    },
  },
  {
    local: "2027-03-07T06:00",
    zone: "Australia/Sydney",
    seats: 12,
    locale: "en-US",
    texts: {
      "en-US": {
        title: "Harbour sunrise swim",
        description: "An easy 1 km swim along the harbour at sunrise, then coffee on the sand.",
      },
      "th-TH": {
        title: "ว่ายน้ำรับแสงอรุณที่อ่าว",
        description: "ว่ายน้ำสบาย ๆ 1 กม. เลียบอ่าวตอนพระอาทิตย์ขึ้น แล้วจิบกาแฟบนหาดทราย",
      },
      "ar-EG": {
        title: "سباحة الشروق في الميناء",
        description:
          "سباحة هادئة لمسافة كيلومتر واحد على طول الميناء عند الشروق، ثم قهوة على الرمال.",
      },
    },
  },
  {
    local: "2027-03-08T19:00",
    zone: "Africa/Cairo",
    seats: 15,
    locale: "ar-EG",
    texts: {
      "ar-EG": {
        title: "أمسية خط عربي",
        description: "ورشة للمبتدئين في الخط العربي، الأدوات متوفرة. أحضر فضولك فقط.",
      },
      "en-US": {
        title: "An evening of Arabic calligraphy",
        description:
          "A beginners' workshop in Arabic calligraphy, with all the tools provided. Just bring your curiosity.",
      },
      "th-TH": {
        title: "ค่ำคืนแห่งอักษรวิจิตรอาหรับ",
        description: "เวิร์กช็อปอักษรวิจิตรอาหรับสำหรับผู้เริ่มต้น มีอุปกรณ์ให้พร้อม แค่นำความอยากรู้มาด้วย",
      },
    },
  },
  {
    local: "2027-03-09T20:00",
    zone: "Asia/Bangkok",
    seats: 1,
    locale: "en-US",
    texts: {
      "en-US": {
        title: "Supper for one",
        description: "A chef's table with a single seat. Whoever books first gets it.",
      },
      "th-TH": {
        title: "มื้อค่ำสำหรับหนึ่งที่",
        description: "โต๊ะเชฟที่มีเพียงที่นั่งเดียว ใครจองก่อนได้ก่อน",
      },
      "ar-EG": {
        title: "عشاء لشخص واحد",
        description: "طاولة الشيف بمقعد واحد فقط. من يحجز أولًا يفوز به.",
      },
    },
  },
];

export default defineSeed<typeof import("./schema")>(async ({ db, schema }) => {
  for (const s of SAMPLES) {
    const [event] = await db
      .insert(schema.events)
      .values({
        ...s.texts[s.locale],
        ...startsAt(s.local, s.zone),
        seats: s.seats,
        locale: s.locale,
      })
      .returning({ id: schema.events.id });
    await db.insert(schema.event_texts).values(
      Object.entries(s.texts)
        .filter(([locale]) => locale !== s.locale)
        .map(([locale, text]) => ({ event_id: event.id, locale, ...text })),
    );
  }
});
