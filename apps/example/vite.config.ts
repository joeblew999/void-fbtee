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
      // Sign in to Cloudflare if needed, and point this project at your account (Void's own
      // command; once per machine): deploys and `void db … --remote` then use it.
      login: { command: "void connect --platform cloudflare", cache: false },
      // Deploy to Cloudflare: https://void-fbtee-example.gedw99.workers.dev (void-fbtee built first),
      // with Workers AI on (void.config.ts: inference.bindings.ai).
      deploy: {
        command: "VOID_AI=1 void deploy --platform cloudflare",
        cache: false,
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
      // The same, all at once: Void asks for this when a Durable Object class changes (it stops
      // and says so). Traffic moves before the readiness check, so only when it asks.
      "deploy:atomic": {
        command: "VOID_AI=1 void deploy --platform cloudflare --atomic",
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
