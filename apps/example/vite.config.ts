import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import voidFbtee from "void-fbtee/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // `vp run <task>` here (or `vp run example#<task>` from anywhere). Each first rebuilds void-fbtee
  // (its `build`), so the example always runs the package as it is in the repo.
  run: {
    tasks: {
      build: { command: "vp build", dependsOn: [{ task: "build", from: "dependencies" }] },
      // Sign in to Cloudflare (void keeps the sign-in in the system keyring).
      login: { command: "void cloudflare login", cache: false },
      // Deploy to Cloudflare: https://void-fbtee-example.gedw99.workers.dev
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
