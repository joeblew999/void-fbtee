import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import voidFbtee from "void-fbtee/vite";

export default defineConfig({
  plugins: [
    voidFbtee({ sourceLocale: "en-US", locales: ["en-US", "th-TH", "de-DE", "ar-EG", "pl-PL"] }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
    voidMarkdown(),
  ],
});
