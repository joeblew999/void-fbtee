---
title: "إعداد void-fbtee في تطبيق Void"
description: "ما يضيفه void-fbtee init إلى تطبيق Void جزءًا جزءًا، لحين يبلّغ void-fbtee check عن مشكلة setup."
translatedFrom: "8bb780714c62"
---

# إعداد void-fbtee في تطبيق Void

يقوم `void-fbtee init` بكل هذا ويضيف ما ينقص فقط، لذا يمكن تشغيله مرة أخرى بأمان. وحين لا يستطيع
تعديل ملف بأمان، يطبع السطر الذي يجب إضافته. هذه هي الأجزاء، لحين يُبلغ `void-fbtee check` عن مشكلة `setup:`.

- **اللغات:** `src/locales.ts` يحوي القائمة مرة واحدة (`export const locales = [...] as const`)
  ويسجّل نوعها (`declare global { interface VoidFbteeRegister }`)، فتفحص المسارات المُنمّطة في Void كل رابط
  يُبنى من لغة الصفحة. ويستوردها `vite.config.ts`.
- **إضافة Vite:** `voidFbtee({ sourceLocale, locales })` من `void-fbtee/vite`، أولًا في
  `plugins` داخل `vite.config.ts` (قبل `voidPlugin()`).
- **الوسيط (middleware):** `middleware/99.i18n.ts` ويحتوي `export { default } from "void-fbtee/middleware";`.
  يقرأ اللغة من الرابط ويضبط `<html lang dir>`.
- **التخطيط:** يغلّف `pages/layout.tsx` محتواه بـ `<I18nProvider>` من `void-fbtee/react`.
- **تحويل الصفحة الرئيسية:** `routing: { redirects: { "/": { to: "/en-US", status: 301 } } }` في
  `void.config.ts`، بلغتك المصدر: يحوّل Void المسار `/` إليها قبل تشغيل أي كود من التطبيق.
- **Temporal:** `worker: { compatibility_flags: ["temporal"] }` في `void.config.ts`، من أجل
  Temporal الأصلي في Cloudflare.
- **TypeScript:** `"fbtee/ReactTypes"` في `compilerOptions.types`، و`"lib"` مع `ES2025`
  و`DOM` و`DOM.Iterable`.
- **الفحص (Vite+):** في `vite.config.ts` الموجود في جذر مساحة العمل، `lint.jsPlugins` مع
  `@nkzw/eslint-plugin-fbtee` و`void-fbtee/lint` وقواعدهما (يطبعها `init`).
- **السكربتات:** `i18n:prepare` و`i18n:check` و`i18n:translate` في `package.json`.
- **الوكلاء:** قسم خاص بـ void-fbtee في `AGENTS.md`، وهذه المهارة مربوطة داخل `.claude/skills/`
  (أو `.agents/skills/`) حين يحتوي التطبيق ذلك المجلد.
