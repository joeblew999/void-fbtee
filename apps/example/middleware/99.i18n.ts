// Locale from the URL, fbtee's per-request state, <html lang dir>. 99 so Void runs it after the
// app's own middleware (01.auth.ts and the like): it adds to the shared and head data they set.
// Void orders middleware by the number (packages/void/src/router/scan.ts, checked 2026-11-12).
export { default } from "void-fbtee/middleware";
