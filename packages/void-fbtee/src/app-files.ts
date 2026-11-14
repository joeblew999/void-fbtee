// The app's files that `void-fbtee init` writes or edits and `void-fbtee check` reads: where each
// is, by the names Void and Vite accept, and how to tell the setup is there.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const VITE_CONFIGS = ["vite.config.ts", "vite.config.mts", "vite.config.js"];
export const VOID_CONFIGS = ["void.config.ts", "void.config.mts", "void.config.js"];
export const LAYOUTS = ["pages/layout.tsx", "pages/layout.jsx"];

/** An app's own "/" page or route: Void's `index` files (guide/pages-routing/overview.md). A new
 * Void app has one, Void's starter page (pages/index.tsx). */
export const HOME_PAGES = [
  ...["tsx", "jsx", "ts", "js", "md", "mdx", "vue", "svelte"].map((e) => `pages/index.${e}`),
  ...["ts", "tsx", "js", "jsx"].map((e) => `routes/index.${e}`),
];

/** void-fbtee's skill, inside the installed package. */
export const SKILL_DIR = "node_modules/void-fbtee/skills/void-fbtee";

/** The first of `names` (paths under `root`) that exists, as its path under `root`. */
export const firstFile = (root: string, names: string[]) =>
  names.find((n) => existsSync(join(root, n)));

/** Whether a file in middleware/ re-exports void-fbtee's middleware. */
export function hasI18nMiddleware(root: string): boolean {
  const dir = join(root, "middleware");
  return (
    existsSync(dir) &&
    readdirSync(dir).some((f) =>
      readFileSync(join(dir, f), "utf8").includes("void-fbtee/middleware"),
    )
  );
}
