import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import voidFbtee from "void-fbtee/vite";

export default defineConfig({
  plugins: [
    voidFbtee({ sourceLocale: "en-US", locales: ["en-US", "ar-EG", "th-TH"] }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
    voidMarkdown(),
  ],
});
