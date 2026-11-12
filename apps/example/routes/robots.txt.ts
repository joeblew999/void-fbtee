// robots.txt, at /robots.txt: every crawler welcome, and where the sitemap is. Made by a route, not
// a file in public/, because the sitemap's line must be a full address: the site's own
// (voidFbtee({ site }), else whichever host is asked), as the pages' canonical. Void's
// page cache keeps it until the next deploy (routing.revalidate in void.config.ts).
import { defineHandler } from "void";
import { siteOrigin } from "void-fbtee/middleware";

export const GET = defineHandler((c) => {
  const origin = siteOrigin(c);
  return c.body(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, 200, {
    "content-type": "text/plain; charset=utf-8",
  });
});
