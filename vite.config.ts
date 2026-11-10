// Root Vite+ config: format, lint and type-check settings for the whole repo.
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    plugins: ["typescript", "react"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
      "no-unused-vars": ["warn", { varsIgnorePattern: "^(fbt|fbs)$" }],
    },
  },
  fmt: {
    // Written by tools, not by hand: fbtee (catalogs), drizzle (migrations), void init (AGENTS.md).
    ignorePatterns: ["**/i18n/translations-src/**", "**/db/migrations/**", "**/AGENTS.md"],
  },
});
