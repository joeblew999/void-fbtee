// `void db seed`: the sample events, one per language, each on its own city's clock. The tests
// start from these (e2e/setup.ts runs `void db seed --yes`). Dates are well ahead, so they stay
// "upcoming".
import { defineSeed } from "void/seed";
import { startsAt } from "./schema/events";

export default defineSeed<typeof import("./schema")>(async ({ db, schema }) => {
  await db.insert(schema.events).values([
    {
      title: "ตลาดนัดกลางคืน: เดินชิมอาหารริมทาง",
      description: "เดินชิมอาหารริมทางกับเพื่อนใหม่ ตั้งแต่ข้าวเหนียวมะม่วงไปจนถึงไก่ย่าง",
      ...startsAt("2027-03-06T18:30", "Asia/Bangkok"),
      seats: 20,
      locale: "th-TH",
    },
    {
      title: "Harbour sunrise swim",
      description: "An easy 1 km swim along the harbour at sunrise, then coffee on the sand.",
      ...startsAt("2027-03-07T06:00", "Australia/Sydney"),
      seats: 12,
      locale: "en-US",
    },
    {
      title: "أمسية خط عربي",
      description: "ورشة للمبتدئين في الخط العربي، الأدوات متوفرة. أحضر فضولك فقط.",
      ...startsAt("2027-03-08T19:00", "Africa/Cairo"),
      seats: 15,
      locale: "ar-EG",
    },
    {
      title: "Supper for one",
      description: "A chef's table with a single seat. Whoever books first gets it.",
      ...startsAt("2027-03-09T20:00", "Asia/Bangkok"),
      seats: 1,
      locale: "en-US",
    },
  ]);
});
