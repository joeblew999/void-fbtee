// Locale from the URL, fbtee's per-request state, <html lang dir>; and a page that showed an event
// not yet in the reader's language asks for its translation (src/content.ts). 99 so Void runs it
// after the app's own middleware (01.auth.ts and the like): it adds to the shared and head data they
// set. Void orders middleware by the number (packages/void/src/router/scan.ts, checked 2026-11-12).
import { i18nMiddleware } from "void-fbtee/middleware";
import { content } from "@/content";

export default i18nMiddleware({ content });
