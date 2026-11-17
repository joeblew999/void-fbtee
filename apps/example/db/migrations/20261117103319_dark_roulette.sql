ALTER TABLE `event_texts` ADD `translated_by` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `event_texts` ADD `translated_at` text;--> statement-breakpoint
ALTER TABLE `event_texts` ADD `gateway_log_id` text;

--> statement-breakpoint
-- Who made the rows already there (plans/translation-provenance.md). The sample events' texts came
-- with their migration (20261111064630_sample_events.sql, "Written by Claude in each language"):
-- "claude", on the date they were added, where each is still exactly as that migration wrote it.
-- Every other row is "unknown" (the column's default) and the app translates it again.
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = '8351d117-5ced-460e-bb11-6dd54b40afb0' AND `title` = 'السوق الليلي: جولة لتذوق طعام الشارع' AND `description` = 'تذوّق طعام الشارع مع أصدقاء جدد، من الأرز اللزج بالمانجو إلى الدجاج المشوي.';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = 'b0d8c1e0-12fd-4ba2-8ad5-e85042669837' AND `title` = 'Night market: a street food walk' AND `description` = 'Taste your way through the street food with new friends, from mango sticky rice to grilled chicken.';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = 'fa459c76-42bc-47bb-9547-74b5739bc513' AND `title` = 'An evening of Arabic calligraphy' AND `description` = 'A beginners'' workshop in Arabic calligraphy, with all the tools provided. Just bring your curiosity.';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = '631c1430-4822-40fe-9ea7-4fa098dd9749' AND `title` = 'ค่ำคืนแห่งอักษรวิจิตรอาหรับ' AND `description` = 'เวิร์กช็อปอักษรวิจิตรอาหรับสำหรับผู้เริ่มต้น มีอุปกรณ์ให้พร้อม แค่นำความอยากรู้มาด้วย';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = '7861c555-0271-4ccf-9eea-6f7426bf7aa1' AND `title` = 'سباحة الشروق في الميناء' AND `description` = 'سباحة هادئة لمسافة كيلومتر واحد على طول الميناء عند الشروق، ثم قهوة على الرمال.';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = 'c895789d-d913-458d-8642-4efbec5c1d10' AND `title` = 'ว่ายน้ำรับแสงอรุณที่อ่าว' AND `description` = 'ว่ายน้ำสบาย ๆ 1 กม. เลียบอ่าวตอนพระอาทิตย์ขึ้น แล้วจิบกาแฟบนหาดทราย';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = '9141ef38-7a29-468a-8292-e065280bed1f' AND `title` = 'عشاء لشخص واحد' AND `description` = 'طاولة الشيف بمقعد واحد فقط. من يحجز أولًا يفوز به.';
--> statement-breakpoint
UPDATE `event_texts` SET `translated_by` = 'claude', `translated_at` = '2026-11-11' WHERE `id` = 'a5a8057b-17dc-4ca8-9c18-bf687788b96c' AND `title` = 'มื้อค่ำสำหรับหนึ่งที่' AND `description` = 'โต๊ะเชฟที่มีเพียงที่นั่งเดียว ใครจองก่อนได้ก่อน';
