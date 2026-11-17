// The events' title and description in the app's other languages, with who made each: the
// package's table (void-fbtee/db/schema). Deleting an event deletes its translations.
import { translationsOf } from "void-fbtee/db/schema";
import { events } from "./events";

export const events_translations = translationsOf(events);
