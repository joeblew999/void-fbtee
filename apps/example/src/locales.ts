// The app's languages, once: voidFbtee() in vite.config.ts gets this list, and the type below gives
// the same list to void-fbtee's types, so a link built from the page's language is checked by Void's
// typed routes (`/${lang}/docs/tour` must be a real page in every language).
export const sourceLocale = "en-US";
export const locales = ["en-US", "ar-EG", "th-TH"] as const;

declare global {
  interface VoidFbteeRegister {
    locales: typeof locales;
  }
}
