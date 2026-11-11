// The example's languages, from its one list (voidFbtee() in apps/example/vite.config.ts), read
// the way `void-fbtee check` reads them. Tests that cover every language use these; tests that
// check one language's own output (Arabic digits, Thai text) name it.
import { join } from "node:path";
import { loadProject } from "../packages/void-fbtee/src/commands";

const { config } = await loadProject(join(import.meta.dirname, "../apps/example"));
/** The language the code is written in. */
export const SOURCE = config.sourceLocale;
/** Every language, the source first. */
export const LOCALES = config.locales.map((l) => l.locale);
/** The languages the source is translated into. */
export const TRANSLATED = LOCALES.filter((l) => l !== SOURCE);
