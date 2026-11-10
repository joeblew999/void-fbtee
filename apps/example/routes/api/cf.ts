// SPIKE: what Cloudflare's request.cf gives us for the default time zone.
import { defineHandler } from "void";
export const GET = defineHandler((c) => {
  const cf = (c.req.raw as Request & { cf?: Record<string, unknown> }).cf;
  return {
    hasCf: !!cf,
    timezone: cf?.timezone ?? null,
    country: cf?.country ?? null,
    acceptLanguage: c.req.header("accept-language") ?? null,
  };
});
