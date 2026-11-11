-- The sample events, one per language, each on its own city's clock, with their text in the other
-- languages (as queues/translate.ts stores it). Written by Claude in each language; ids fixed, and
-- INSERT OR IGNORE, so a database that has them already (production) is left as it is.
-- A new language: add its text in a new migration.
INSERT OR IGNORE INTO `events` (`id`, `title`, `description`, `starts_at`, `starts_at_utc`, `seats`, `locale`, `created_at`, `updated_at`) VALUES ('1854bc63-4a98-466d-963e-4447259889e4', 'ตลาดนัดกลางคืน: เดินชิมอาหารริมทาง', 'เดินชิมอาหารริมทางกับเพื่อนใหม่ ตั้งแต่ข้าวเหนียวมะม่วงไปจนถึงไก่ย่าง', '2027-03-06T18:30:00+07:00[Asia/Bangkok]', '2027-03-06T11:30:00Z', 20, 'th-TH', '2026-11-11 05:13:47', '2026-11-11 05:13:47');
--> statement-breakpoint
INSERT OR IGNORE INTO `events` (`id`, `title`, `description`, `starts_at`, `starts_at_utc`, `seats`, `locale`, `created_at`, `updated_at`) VALUES ('fb55d243-b2f0-4a4e-b3de-c666662fdaf9', 'Harbour sunrise swim', 'An easy 1 km swim along the harbour at sunrise, then coffee on the sand.', '2027-03-07T06:00:00+11:00[Australia/Sydney]', '2027-03-06T19:00:00Z', 12, 'en-US', '2026-11-11 05:13:47', '2026-11-11 05:13:47');
--> statement-breakpoint
INSERT OR IGNORE INTO `events` (`id`, `title`, `description`, `starts_at`, `starts_at_utc`, `seats`, `locale`, `created_at`, `updated_at`) VALUES ('d57a8bf2-5909-4475-a407-12a879df5f01', 'أمسية خط عربي', 'ورشة للمبتدئين في الخط العربي، الأدوات متوفرة. أحضر فضولك فقط.', '2027-03-08T19:00:00+02:00[Africa/Cairo]', '2027-03-08T17:00:00Z', 15, 'ar-EG', '2026-11-11 05:13:47', '2026-11-11 05:13:47');
--> statement-breakpoint
INSERT OR IGNORE INTO `events` (`id`, `title`, `description`, `starts_at`, `starts_at_utc`, `seats`, `locale`, `created_at`, `updated_at`) VALUES ('533dfc9c-35cd-46e5-9129-28edf6706600', 'Supper for one', 'A chef''s table with a single seat. Whoever books first gets it.', '2027-03-09T20:00:00+07:00[Asia/Bangkok]', '2027-03-09T13:00:00Z', 1, 'en-US', '2026-11-11 05:34:41', '2026-11-11 05:34:41');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('8351d117-5ced-460e-bb11-6dd54b40afb0', '1854bc63-4a98-466d-963e-4447259889e4', 'ar-EG', 'السوق الليلي: جولة لتذوق طعام الشارع', 'تذوّق طعام الشارع مع أصدقاء جدد، من الأرز اللزج بالمانجو إلى الدجاج المشوي.', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('b0d8c1e0-12fd-4ba2-8ad5-e85042669837', '1854bc63-4a98-466d-963e-4447259889e4', 'en-US', 'Night market: a street food walk', 'Taste your way through the street food with new friends, from mango sticky rice to grilled chicken.', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('fa459c76-42bc-47bb-9547-74b5739bc513', 'd57a8bf2-5909-4475-a407-12a879df5f01', 'en-US', 'An evening of Arabic calligraphy', 'A beginners'' workshop in Arabic calligraphy, with all the tools provided. Just bring your curiosity.', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('631c1430-4822-40fe-9ea7-4fa098dd9749', 'd57a8bf2-5909-4475-a407-12a879df5f01', 'th-TH', 'ค่ำคืนแห่งอักษรวิจิตรอาหรับ', 'เวิร์กช็อปอักษรวิจิตรอาหรับสำหรับผู้เริ่มต้น มีอุปกรณ์ให้พร้อม แค่นำความอยากรู้มาด้วย', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('7861c555-0271-4ccf-9eea-6f7426bf7aa1', 'fb55d243-b2f0-4a4e-b3de-c666662fdaf9', 'ar-EG', 'سباحة الشروق في الميناء', 'سباحة هادئة لمسافة كيلومتر واحد على طول الميناء عند الشروق، ثم قهوة على الرمال.', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('c895789d-d913-458d-8642-4efbec5c1d10', 'fb55d243-b2f0-4a4e-b3de-c666662fdaf9', 'th-TH', 'ว่ายน้ำรับแสงอรุณที่อ่าว', 'ว่ายน้ำสบาย ๆ 1 กม. เลียบอ่าวตอนพระอาทิตย์ขึ้น แล้วจิบกาแฟบนหาดทราย', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('9141ef38-7a29-468a-8292-e065280bed1f', '533dfc9c-35cd-46e5-9129-28edf6706600', 'ar-EG', 'عشاء لشخص واحد', 'طاولة الشيف بمقعد واحد فقط. من يحجز أولًا يفوز به.', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
--> statement-breakpoint
INSERT OR IGNORE INTO `event_texts` (`id`, `event_id`, `locale`, `title`, `description`, `created_at`, `updated_at`) VALUES ('a5a8057b-17dc-4ca8-9c18-bf687788b96c', '533dfc9c-35cd-46e5-9129-28edf6706600', 'th-TH', 'มื้อค่ำสำหรับหนึ่งที่', 'โต๊ะเชฟที่มีเพียงที่นั่งเดียว ใครจองก่อนได้ก่อน', '2026-11-11 05:59:03', '2026-11-11 05:59:03');
