// What people write in the app's tables, translated into its languages (void-fbtee/content): the
// schema, the database and the queue handed to the package once, so everything it gives is typed
// from them. Written by `void-fbtee gen translations events title description`; the session is the
// app's own (src/db.ts).
import * as schema from "@schema";
import { queues } from "void/queues";
import { translatedContent, type TranslateQueue } from "void-fbtee/content";
import { primaryDb } from "./db";

export const content = translatedContent(schema, {
  db: primaryDb,
  queue: (): TranslateQueue => queues.translate,
});
