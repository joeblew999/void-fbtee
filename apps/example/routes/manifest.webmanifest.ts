// The web app manifest, at /manifest.webmanifest (Void drops only the `.ts`), made when it's asked
// for, so its description comes from the translation catalogs and can't drift from them. Chrome and
// Edge 148 read `description_localized` (one manifest, translated in place: Chrome's blog
// "Localization support for web app manifests", 2026-04-24; MDN "*_localized"). The name is a
// name, not translated. Void's page cache keeps it until the next deploy, which is the only thing
// that changes the catalogs (routing.revalidate in void.config.ts).
//
// An installed app opens at "/", which goes to the source language: the browser picks the
// manifest's text by the reader's language, but has no way to pick a start page by it.
import { defineHandler } from "void";
import { fbs } from "fbtee";
import { inEveryLocale } from "void-fbtee/middleware";
import type { WebAppManifest } from "web-app-manifest";

/** A translated text field, as `*_localized` takes it: a string, or with its own language and direction. */
type Localized = Record<string, string | { value: string; lang?: string; dir?: "ltr" | "rtl" }>;

export const GET = defineHandler(async (c) => {
  const description = await inEveryLocale(({ locale, dir }) => ({
    locale,
    dir,
    value: String(
      fbs(
        "i18n for Void apps: fbtee strings, Temporal dates, Intl formatting.",
        "The site's description, as an installed app shows it",
      ),
    ),
  }));
  const [source, ...others] = Object.values(description);
  const manifest: WebAppManifest & { description_localized: Localized } = {
    id: "/",
    name: "void-fbtee",
    short_name: "void-fbtee",
    lang: source.locale,
    dir: source.dir,
    description: source.value,
    description_localized: Object.fromEntries(
      others.map((d) => [d.locale, { value: d.value, lang: d.locale, dir: d.dir }]),
    ),
    start_url: "/",
    display: "standalone",
    background_color: "#14161c",
    theme_color: "#14161c",
    icons: [
      { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return c.body(JSON.stringify(manifest, null, 2), 200, {
    "content-type": "application/manifest+json; charset=utf-8",
  });
});
