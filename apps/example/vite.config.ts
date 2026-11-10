import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import fbtee from "@nkzw/vite-plugin-fbtee";

// SPIKE: fbtee only exports `fbtee/server` (per-request AsyncLocalStorage
// state) under the `node` condition. workerd is not `node`, so on the worker
// we point `fbtee/server` at that file. Void turns on nodejs_als.
// `fbtee` and `fbtee/server` must share one core module, so the worker
// does not pre-bundle fbtee (a pre-bundle would hold its own copy).
const fbteeIndex = createRequire(import.meta.url).resolve("fbtee"); // .../fbtee/lib/index.mjs
const fbteeServer = fbteeIndex.replace(/index\.mjs$/, "index-server.mjs");

function fbteeServerOnWorker(): Plugin {
  return {
    name: "spike:fbtee-server-on-worker",
    enforce: "pre",
    configEnvironment(name) {
      if (name === "client") return;
      return { optimizeDeps: { exclude: ["fbtee"], include: ["fbtee > invariant"] } };
    },
    resolveId(id) {
      if (this.environment.name === "client") return;
      if (id === "fbtee/server") return fbteeServer;
      // Cloudflare's native Temporal shipped broken once and was pulled (workerd#6907),
      // so the server always uses the polyfill's own code, never "native if present".
      if (id === "temporal-polyfill")
        return this.resolve("temporal-polyfill/implementation", undefined, { skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [fbteeServerOnWorker(), fbtee(), voidPlugin(), voidReact({ react: { compiler: true } })],
});
