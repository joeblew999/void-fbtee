import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidMarkdown } from "@void/md/plugin";
import { voidFbtee } from "void-fbtee/plugin";
import { locales, sourceLocale } from "./src/locales.ts";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/site";

export default defineConfig({
  // `vp run <task>` here (or `vp run example#<task>` from anywhere). `build` is Void's script in
  // package.json; `vp run -t example#build` builds void-fbtee first.
  run: {
    tasks: {
      // Sign in to Cloudflare if needed, and point this project at your account (Void's own
      // command; once per machine). It saves the platform in .void/project.json, so deploys and
      // `void db … --remote` use Cloudflare without saying so.
      login: { command: "void connect --platform cloudflare", cache: false },
      // Void's own: the deployment's state, its logs (a live tail), and going back a version.
      status: { command: "void project status", cache: false },
      logs: { command: "void project logs", cache: false },
      rollback: { command: "void project rollback", cache: false },
      // Deploy to Cloudflare: https://void-fbtee-example.gedw99.workers.dev (void-fbtee built first).
      // --platform cloudflare: a fresh checkout (Cloudflare's Workers Builds) has no .void/project.json.
      deploy: {
        // Email: the send_email binding from void.lock.json (`void email setup`). Not
        // --require-email: Workers Builds' token can't read Email Routing and Email Sending
        // settings, so that check fails there even though sending is set up.
        command: "void deploy --platform cloudflare",
        cache: false,
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
      // The same, all at once: Void asks for this when a Durable Object class changes (it stops
      // and says so). Traffic moves before the readiness check, so only when it asks.
      "deploy:atomic": {
        command: "void deploy --platform cloudflare --atomic",
        cache: false,
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
    },
  },
  // The dev server always on 5173 (stops if it's taken, rather than moving), where
  // `vp run tailscale:login` points Tailscale Funnel; and its public *.ts.net address let in.
  server: { port: 5173, strictPort: true, allowedHosts: [".ts.net"] },
  // shadcn's "@/" import alias (tsconfig.json "paths" says the same for TypeScript).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    // site: the deployed address, so the dev server and Worker Previews name it in canonical,
    // hreflang, og:url and the sitemap.
    voidFbtee({ sourceLocale, locales, site: SITE }),
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
    voidMarkdown(),
    tailwindcss(),
  ],
  // `vp test` (or `vp run example#test` from anywhere): the example's own unit tests, beside its
  // code in src/. They run in Node.js with no Worker (Void's docs/guide/testing.md); the browser
  // tests are e2e/ at the repo's root.
  test: { include: ["src/**/*.test.ts"] },
});
