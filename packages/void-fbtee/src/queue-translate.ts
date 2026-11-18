// `void-fbtee/queues/translate`: the consumer of the app's `queues/translate.ts`
// (plans/translated-content.md). Each message is one row of content ({ table, id }); every
// language it lacks, or whose translation was made before the row was changed, is translated by
// Void's AI (ai.ts translateFields), every language at once, each stored as soon as it's done,
// with who made it, the request's gateway log, what it cost and what it was made from, so a retry
// asks (and pays) only for what's still missing. The app's file, at Void's own place:
//
//   // queues/translate.ts
//   import "void/ai"; // Void connects its AI when the app's own files import it
//   export const maxRetries = 5; // Void reads these from this file, as numbers
//   export const retryDelay = 300;
//   export default translationQueue({ onTranslated }); // or: export { default } from …
//
// `onTranslated` is the app's: which of its pages to refresh, which live topic to tell.
import { defineQueue } from "void";
import config from "virtual:void-fbtee/config";
import { translateFields } from "./ai";
import { contentTables, storeTranslation, untranslated, type TranslateMessage } from "./content";
import { GEMINI, paymentAdvice, paymentProblem } from "./models";

// When the account isn't paying for the model (credits used up, a spend limit reached), an hour
// before trying again: nothing changes sooner without someone (models.ts paymentProblem).
const PAYMENT_DELAY = 60 * 60;

export interface TranslationQueueOptions {
  /** After a row's translation into `locale` is stored: refresh its pages, tell open ones. */
  onTranslated?: (table: string, id: string, locale: string) => unknown;
}

export function translationQueue({ onTranslated }: TranslationQueueOptions = {}) {
  return defineQueue<TranslateMessage>(async (batch) => {
    for (const message of batch.messages) {
      const { table, id } = message.body;
      const found = contentTables().has(table) ? await untranslated(table, id) : undefined;
      // Gone (deleted, its translations with it), or a table the app no longer translates.
      if (!found) {
        message.ack();
        continue;
      }
      try {
        // Every language at once, each stored as soon as it's done: one after the other, a post's
        // last language waited for all the others (Gemini 4 Hydrogen thinks before it answers:
        // about 5 s each, so a post took over 30 s to read in Thai on the live site, 2026-11-18).
        // One failing leaves the others stored; the message is tried again for what's missing.
        const results = await Promise.allSettled(
          found.missing.map(async (locale) => {
            // Only the fields: the row's other columns aren't to be translated.
            const done = await translateFields(found.source.fields, {
              from: found.source.locale,
              to: locale,
              app: config.app,
            });
            if (
              await storeTranslation(table, id, locale, done.result, {
                by: GEMINI.id,
                gatewayLogId: done.logId,
                usage: done.usage,
                from: found.from,
              })
            )
              await onTranslated?.(table, id, locale);
          }),
        );
        const failed = results.find((r) => r.status === "rejected");
        if (failed) throw failed.reason;
        message.ack();
      } catch (error) {
        // Deleted while it was being translated: its translations can't go in (the foreign key
        // refuses them), and there's nothing left to translate.
        if (!(await untranslated(table, id))) {
          message.ack();
          continue;
        }
        const payment = paymentProblem(error);
        if (payment) {
          console.warn(`void-fbtee: translation waits an hour: ${paymentAdvice[payment]}`);
          message.retry({ delaySeconds: PAYMENT_DELAY });
          continue;
        }
        // D1's own reason is the error's cause.
        const cause = (error as { cause?: unknown }).cause;
        console.warn(
          "void-fbtee: translation failed, retried:",
          String(error),
          cause instanceof Error ? cause.message : "",
        );
        message.retry();
      }
    }
  });
}

/** The consumer with no app hook: `export { default } from "void-fbtee/queues/translate"`. */
export default translationQueue();
