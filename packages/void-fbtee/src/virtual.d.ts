// Modules the void-fbtee Vite plugin makes at the app's build time.
declare module "virtual:void-fbtee/config" {
  const config: import("./runtime").RuntimeConfig;
  export default config;
}
declare module "virtual:void-fbtee/catalogs" {
  /** One lazy loader per translated locale; each resolves to { [locale]: fbtee's table }. */
  const catalogs: import("./runtime").CatalogLoaders;
  export default catalogs;
}
declare module "virtual:void-fbtee/texts" {
  /** Dev only: each string's source text by hash, for naming untranslated strings. Empty in builds. */
  const texts: Record<string, string>;
  export default texts;
}
declare module "virtual:void-fbtee/hono-route" {
  /** Hono's matchedRoutes (hono/route), from the Hono Void runs on. Server only. */
  export const matchedRoutes: (
    c: unknown,
  ) => Array<{ path: string; method: string; handler: Function }>;
}
declare module "virtual:void-fbtee/md-pages" {
  /** The app's markdown pages, from @void/md's own list (its path and frontmatter), or [] without @void/md. */
  const pages: ReadonlyArray<{ path: string; frontmatter: Record<string, unknown> }>;
  export default pages;
}

declare module "virtual:void-fbtee/zod" {
  /** Zod's own messages in the current language (plugin.ts, zodMessages); a no-op without Zod 4. */
  export function setup(currentLocale: () => string | undefined): void;
}
