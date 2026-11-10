// Root Vite+ config: format, lint and type-check settings for the whole repo.
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    // e2e/fresh/<toolchain>/: what `void init` wrote, kept as it wrote it (no node_modules there).
    ignorePatterns: ["e2e/fresh/vite-plus/**", "e2e/fresh/vite/**"],
    plugins: ["typescript", "react"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // `fbt` / `fbs` are used through <fbt> JSX, which fbtee's compiler rewrites into calls.
      "no-unused-vars": ["warn", { varsIgnorePattern: "^(fbt|fbs)$" }],
    },
  },
  fmt: {
    // Written by tools, not by hand: fbtee (catalogs), drizzle (migrations), void init (AGENTS.md
    // and the fresh-install apps in e2e/fresh/).
    ignorePatterns: [
      "**/i18n/translations/**",
      "**/db/migrations/**",
      "**/AGENTS.md",
      "e2e/fresh/vite-plus/**",
      "e2e/fresh/vite/**",
    ],
  },
});
