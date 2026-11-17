// `void-fbtee/queues/translate`: the consumer of the app's `queues/translate.ts`
// (plans/translated-content.md). Each message is one row of content ({ table, id }); every
// language it lacks is translated by Void's AI (ai.ts translate) and stored as soon as it's done,
// with who made it and the request's gateway log, so a retry asks (and pays) only for what's still
// missing. The app's file, at Void's own place:
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
import { translate } from "./ai";
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
      const about = contentTables().get(table)?.about;
      const found = about ? await untranslated(table, id) : undefined;
      // Gone (deleted, its translations with it), or a table the app no longer translates.
      if (!found) {
        message.ack();
        continue;
      }
      try {
        for (const locale of found.missing) {
          let gatewayLogId: string | undefined;
          // Only the fields: the row's other columns aren't to be translated.
          const fields = await translate(found.source.fields, {
            from: found.source.locale,
            to: locale,
            about: about!,
            app: config.app,
            onLog: (logId) => (gatewayLogId = logId),
          });
          if (await storeTranslation(table, id, locale, fields, { by: GEMINI.id, gatewayLogId }))
            await onTranslated?.(table, id, locale);
        }
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
