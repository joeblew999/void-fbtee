---
title: "การตั้งค่า void-fbtee ในแอป Void"
description: "สิ่งที่ void-fbtee init เพิ่มให้แอป Void ทีละส่วน สำหรับเมื่อ void-fbtee check รายงานปัญหา setup"
translatedFrom: "8bb780714c62"
---

# การตั้งค่า void-fbtee ในแอป Void

`void-fbtee init` ทำทั้งหมดนี้ให้ และเพิ่มเฉพาะสิ่งที่ยังไม่มี จึงรันซ้ำได้อย่างปลอดภัย หากแก้ไฟล์ใดอย่างปลอดภัยไม่ได้
ก็จะพิมพ์บรรทัดที่ต้องเพิ่มออกมาแทน ส่วนต่าง ๆ มีดังนี้ สำหรับเวลาที่ `void-fbtee check` รายงานปัญหา `setup:`

- **ภาษา:** `src/locales.ts` มีรายการภาษาเพียงที่เดียว (`export const locales = [...] as const`)
  และลงทะเบียนชนิดของมัน (`declare global { interface VoidFbteeRegister }`) ลิงก์ที่สร้างจากภาษาของหน้าจึงถูกตรวจ
  โดย typed routes ของ Void และ `vite.config.ts` นำเข้ารายการนี้
- **ปลั๊กอิน Vite:** `voidFbtee({ sourceLocale, locales })` จาก `void-fbtee/vite` เป็นตัวแรกใน
  `plugins` ใน `vite.config.ts` (ก่อน `voidPlugin()`)
- **มิดเดิลแวร์:** `middleware/99.i18n.ts` ที่มี `export { default } from "void-fbtee/middleware";`
  ทำหน้าที่อ่านภาษาจาก URL และตั้งค่า `<html lang dir>`
- **เลย์เอาต์:** `pages/layout.tsx` ครอบเนื้อหาด้วย `<I18nProvider>` จาก `void-fbtee/react`
- **การเปลี่ยนเส้นทางหน้าแรก:** `routing: { redirects: { "/": { to: "/en-US", status: 301 } } }` ใน
  `void.config.ts` โดยใช้ภาษาต้นฉบับของคุณ Void ส่ง `/` ไปที่นั่นก่อนโค้ดของแอปจะทำงาน
- **Temporal:** `worker: { compatibility_flags: ["temporal"] }` ใน `void.config.ts` สำหรับ
  Temporal แบบเนทีฟของ Cloudflare
- **TypeScript:** `"fbtee/ReactTypes"` ใน `compilerOptions.types` และ `"lib"` ที่มี `ES2025`,
  `DOM` และ `DOM.Iterable`
- **Lint (Vite+):** ใน `vite.config.ts` ที่รากของ workspace ให้มี `lint.jsPlugins` พร้อม
  `@nkzw/eslint-plugin-fbtee` และ `void-fbtee/lint` รวมถึงกฎของทั้งสอง (`init` พิมพ์ออกมาให้)
- **สคริปต์:** `i18n:prepare`, `i18n:check` และ `i18n:translate` ใน `package.json`
- **เอเจนต์:** ส่วนของ void-fbtee ใน `AGENTS.md` และสกิลนี้ที่ลิงก์ไว้ใน `.claude/skills/`
  (หรือ `.agents/skills/`) เมื่อแอปมีโฟลเดอร์นั้น
