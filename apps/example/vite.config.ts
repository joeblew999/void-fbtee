import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import voidFbtee from "void-fbtee/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // shadcn's "@/" import alias (tsconfig.json "paths" says the same for TypeScript).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [
    voidFbtee({ sourceLocale: "en-US", locales: ["en-US", "ar-EG", "th-TH"] }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
    voidMarkdown(),
    tailwindcss(),
  ],
});
