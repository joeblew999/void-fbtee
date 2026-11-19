// Zod's own validation messages (a form's errors) in each request's language: the app's Zod 4 and
// its message sets come from virtual:void-fbtee/zod (dev/plugin.ts, zodMessages); this points Zod
// at the current language's set, else English. Nothing without Zod 4 in the app.
import zod from "virtual:void-fbtee/zod";

export function setupZod(currentLocale: () => string | undefined): void {
  if (!zod) {
    return;
  }
  const { sets, fallback } = zod;
  zod.config({ localeError: (issue) => (sets[currentLocale() ?? ""] ?? fallback)(issue) });
}
