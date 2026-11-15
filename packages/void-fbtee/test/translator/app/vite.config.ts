// The translator test's app (e2e/translator/): its strings, as fbtee strings in real code
// (src/strings.tsx), and its catalogs, i18n/translations/<locale>.json, in fbtee's own format,
// every entry translated: those translations are the references the test scores Void's AI against.
// Written by Claude Code on 2026-11-15, not yet reviewed by native speakers. Adding a language:
// add it here and give its catalog every entry.
import { defineConfig } from "vite";
import { voidFbtee } from "void-fbtee/plugin";

export default defineConfig({
  plugins: [
    voidFbtee({
      sourceLocale: "en-US",
      locales: [
        "en-US",
        "ar-EG",
        "de-DE",
        "es-ES",
        "fr-FR",
        "hi-IN",
        "id-ID",
        "ja-JP",
        "ko-KR",
        "ru-RU",
        "th-TH",
        "vi-VN",
        "zh-CN",
      ],
      src: ["src/**/*.tsx"],
    }),
  ],
});
