// Test fixture: an app whose only plugin is void-fbtee, for `loadProject` (Vite's own loader).
import { defineConfig } from "vite";
import { voidFbtee } from "void-fbtee/plugin";

export default defineConfig({
  plugins: [
    voidFbtee({
      sourceLocale: "en-US",
      locales: ["en-US", "de-DE", "th-TH"],
      src: ["src/**/*.tsx"],
    }),
  ],
});
