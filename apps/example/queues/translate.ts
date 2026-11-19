// What people post, translated into the app's other languages by the package
// (void-fbtee/queues/translate), with the app's content (src/content.ts). Void reads this file: its
// AI is connected because the app's own files import void/ai, and the retries are read from here,
// as numbers (5, 5 minutes apart; an hour apart while the account isn't paying for the model).
import "void/ai";
import { translationQueue } from "void-fbtee/queues/translate";
import { content } from "@/content";
import { onTranslated, onTranslationFailed } from "@/events/translations";

export const maxRetries = 5;
export const retryDelay = 300;

export default translationQueue(content, { onTranslated, onTranslationFailed });
