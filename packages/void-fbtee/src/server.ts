// Server code in a language of its own choosing, not the request's: a scheduled job (crons/), a
// queue consumer (queues/) or an email, which Void runs with no request, so the middleware has set
// no language (Void's docs: guide/jobs.md, defineScheduled(async (controller, env) => …);
// guide/queues.md, defineQueue(async (batch, env) => …)). Also for one person's language inside a
// request in another (an email to the organiser, sent while a visitor books).
import { runWithFbtee } from "fbtee/server";
import config from "virtual:void-fbtee/config";
import catalogs from "virtual:void-fbtee/catalogs";
import type { AppLocale, Dir } from "./locales";
import { allTranslations } from "./runtime";

/**
 * Runs `fn` in one of the app's languages: `fbs(…)` and `<fbt>` there are in it, with the same
 * catalogs and fallbacks as a page, including after an `await`. `fn` gets the language and its text
 * direction, for Intl and Temporal (`toLocaleString(locale, …)`) and for an email's `dir`.
 *
 *   const subject = await inLocale(user.locale, () => fbs("Your booking", "Email subject: …"));
 *
 * A language the app doesn't have is an error, not a quiet fall back to the source: it's a stored
 * value gone wrong (a user's language from before a language was removed), and should be seen.
 */
export async function inLocale<T>(
  locale: AppLocale,
  fn: (language: { locale: AppLocale; dir: Dir }) => T,
): Promise<Awaited<T>> {
  const found = config.locales.find((l) => l.locale === locale);
  if (!found)
    throw new Error(
      `void-fbtee: inLocale("${locale}"): not one of the app's languages (${config.locales.map((l) => l.locale).join(", ")})`,
    );
  const { sourceLocale, fallbackLocales } = config;
  const translations = await allTranslations(catalogs);
  return await runWithFbtee({ locale, sourceLocale, fallbackLocales, translations }, () =>
    fn({ locale, dir: found.dir }),
  );
}
