// Void's docs example of a server route (guide/server-routing.md: routes/api/hello.ts), with a
// translated message, in the language the caller asks for (Accept-Language).
import { defineHandler } from "void";
import { fbs } from "fbtee";

export const GET = defineHandler((c) => ({
  locale: c.get("i18n")?.locale ?? null,
  message: String(fbs("i18n for Void apps", "Home page heading")),
}));
