// void-fbtee/head: a page's tags for search results and link previews, in its own language.
//
// unhead's unpackMeta (unhead/utils, a pure function: none of unhead's head manager) writes the
// tags from readable keys ({ ogTitle, twitterCard, ogImage: { url, width, … } }), knowing which
// are `property` (Open Graph) and which `name`. The result is Void's own meta shape, for a page's
// head(), a markdown page's (the middleware) or the site's (void.config.ts's head).
import type { MetaFlat } from "unhead/types";
import { unpackMeta } from "unhead/utils";

/** One meta tag, as Void's head takes it. */
export type MetaTag = { name?: string; property?: string; content: string };

/**
 * Meta tags from unhead's readable keys: `meta({ ogSiteName: "Acme", twitterCard:
 * "summary_large_image" })` is `[{ property: "og:site_name", … }, { name: "twitter:card", … }]`.
 */
export function meta(input: MetaFlat): MetaTag[] {
  return unpackMeta(input).flatMap((tag) => {
    const { name, property, content } = tag as {
      name?: string;
      property?: string;
      content?: string | number | boolean | null;
    };
    if (content === undefined || content === null || content === "") return [];
    return [
      { ...(name ? { name } : {}), ...(property ? { property } : {}), content: String(content) },
    ];
  });
}

/**
 * A page's head: its title and description, for the browser tab and search results, and the same
 * two for link previews (og:title, og:description; X reads those). Pass the page's own strings,
 * `fbs(…)` included, so they're in the page's language:
 * `export const head = defineHead(() => pageHead({ title: fbs(…), description: fbs(…) }))`.
 */
export function pageHead(page: { title: unknown; description: unknown }): {
  title: string;
  meta: MetaTag[];
} {
  const title = String(page.title);
  const description = String(page.description);
  return { title, meta: meta({ description, ogTitle: title, ogDescription: description }) };
}
