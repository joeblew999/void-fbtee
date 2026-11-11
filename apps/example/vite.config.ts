import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import voidFbtee from "void-fbtee/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // `vp run <task>` here (or `vp run example#<task>` from anywhere). `build` is Void's script in
  // package.json; `vp run -t example#build` builds void-fbtee first.
  run: {
    tasks: {
      // Sign in to Cloudflare (void keeps the sign-in in the system keyring).
      login: { command: "void cloudflare login", cache: false },
      // Deploy to Cloudflare: https://void-fbtee-example.gedw99.workers.dev (void-fbtee built first).
      deploy: {
        command: "void deploy --platform cloudflare",
        cache: false,
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
    },
  },
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
