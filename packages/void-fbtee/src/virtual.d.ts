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
