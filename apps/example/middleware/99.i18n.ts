// SPIKE: one request = one fbtee state, held in AsyncLocalStorage by fbtee itself.
import { defineMiddleware } from "void";
import { runWithFbtee } from "fbtee/server";

const LOCALES = ["en-US", "th-TH", "de-DE"];
const catalogs = import.meta.glob<Record<string, unknown>>("../i18n/translations/*.json", { import: "default" });

export default defineMiddleware(async (c, next) => {
  const seg = c.req.path.split("/")[1] ?? "";
  const locale = LOCALES.includes(seg) ? seg : "en-US";
  const load = catalogs[`../i18n/translations/${locale}.json`];
  const table = load ? await load() : {};
  c.set("shared", { ...(c.get("shared") as object), i18n: { locale } } as never);
  c.set("headDefaults", { ...(c.get("headDefaults") as object), htmlAttrs: { lang: locale } } as never);
  await runWithFbtee({ locale, translations: table as never }, () => next());
});
