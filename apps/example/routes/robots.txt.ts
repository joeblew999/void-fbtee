// robots.txt, at /robots.txt: every crawler welcome, and where the sitemap is. Made by a route, not
// a file in public/, because the sitemap's line must be a full address, and this way it's the
// address of whichever site is asked (the deployed one, a Worker Preview, the dev server). Void's
// page cache keeps it until the next deploy (routing.revalidate in void.config.ts).
import { defineHandler } from "void";

export const GET = defineHandler((c) => {
  const origin = new URL(c.req.url).origin;
  return c.body(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, 200, {
    "content-type": "text/plain; charset=utf-8",
  });
});
