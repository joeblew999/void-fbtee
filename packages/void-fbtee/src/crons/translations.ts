// `void-fbtee/crons/translations`: the app's `crons/translations.ts` job (plans/translated-content.md).
// It keeps every table of content in the app's languages, both ways: translations into a language
// the app no longer has are deleted, and every row missing one, or with an "unknown" one, is queued
// (content.ts reconcile). A backstop: a row read in a language it lacks is queued then (the
// middleware). The app's file, at Void's own place (written by `void-fbtee gen translations`):
//
//   // crons/translations.ts
//   import { translationsCron } from "void-fbtee/crons/translations";
//   import { content } from "@/content";
//   export const cron = "17 4 * * *"; // Void reads it from this file
//   export default translationsCron(content);
import { defineScheduled } from "void";
import type { TranslatedContent } from "../content";

export function translationsCron(content: Pick<TranslatedContent, "reconcile">) {
  return defineScheduled(async () => {
    const { deleted, queued } = await content.reconcile();
    if (deleted || queued) {
      console.log(`void-fbtee: translations: ${deleted} deleted, ${queued} rows queued`);
    }
  });
}
