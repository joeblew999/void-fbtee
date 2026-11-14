import { defineHandler, defineHead, defer } from "void";
import { fbs } from "fbtee";
import type { WebSite, WithContext } from "schema-dts";
import { jsonLd, pageHead } from "void-fbtee/head";
import type { InferProps } from "void";
import { langParams, siteOrigin } from "void-fbtee/server";
import { SITE_NAME } from "@/site";

// Cached until the next deploy, in every language (Void's prerendering: a one-year cache time,
// and a deploy clears the cache). Void's own platform also builds it during the deploy; deployed
// straight to Cloudflare, as here, the first visit after a deploy builds it. Only a deploy
// changes this page (its loader's values are fixed (defer is a demo)).
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  return {
    count: 3,
    // Resolves after the shell has been sent, so it renders after next() returned.
    late: defer(async () => {
      await new Promise((r) => setTimeout(r, 300));
      return { count: 1 };
    }),
  };
});

// The tab's title and the search result's text, in the page's language (head() runs inside
// void-fbtee's per-request state, after the loader). The title is the heading's own string.
// The tab's title and the search result's text, in the page's language, and the site described for
// search engines (schema.org's WebSite; Google reads it on a site's root home page, which here is a
// redirect, so it may pass it by: no harm).
export const head = defineHead((c) => {
  const { locale, lang } = c.get("i18n");
  const description = fbs(
    "An example Void app in three languages: events to post and book, and docs on how it's done.",
    "Home page description, for search results",
  );
  const site: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${siteOrigin(c)}/${lang}`,
    inLanguage: locale,
    description: String(description),
  };
  return {
    ...pageHead({ title: fbs("i18n for Void apps", "Home page heading"), description }),
    script: [jsonLd(site)],
  };
});
