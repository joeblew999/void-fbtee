---
translatedFrom: "17c00e7e4bf9"
---

# إعداد void-fbtee في تطبيق Void

يقوم `void-fbtee init` بكل هذا ويضيف ما ينقص فقط، لذا يمكن تشغيله مرة أخرى بأمان. وحين لا يستطيع
تعديل ملف بأمان، يطبع السطر الذي يجب إضافته. هذه هي الأجزاء، لحين يُبلغ `void-fbtee check` عن مشكلة `setup:`.

- **إضافة Vite:** `voidFbtee({ sourceLocale, locales })` من `void-fbtee/vite`، أولًا في
  `plugins` داخل `vite.config.ts` (قبل `voidPlugin()`).
- **الوسيط (middleware):** `middleware/99.i18n.ts` ويحتوي `export { default } from "void-fbtee/middleware";`.
  يقرأ اللغة من الرابط ويضبط `<html lang dir>`.
- **التخطيط:** يغلّف `pages/layout.tsx` محتواه بـ `<I18nProvider>` من `void-fbtee/react`.
- **Temporal:** `worker: { compatibility_flags: ["temporal"] }` في `void.config.ts`، من أجل
  Temporal الأصلي في Cloudflare.
- **TypeScript:** `"fbtee/ReactTypes"` في `compilerOptions.types`، و`"lib"` مع `ES2025`
  و`DOM` و`DOM.Iterable`.
- **الفحص (Vite+):** في `vite.config.ts` الموجود في جذر مساحة العمل، `lint.jsPlugins` مع
  `@nkzw/eslint-plugin-fbtee` و`void-fbtee/lint` وقواعدهما (يطبعها `init`).
- **السكربتات:** `i18n:prepare` و`i18n:check` و`i18n:translate` في `package.json`.
- **الوكلاء:** قسم خاص بـ void-fbtee في `AGENTS.md`، وهذه المهارة مربوطة داخل `.claude/skills/`
  (أو `.agents/skills/`) حين يحتوي التطبيق ذلك المجلد.
