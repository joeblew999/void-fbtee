// Modules the void-fbtee Vite plugin makes at the app's build time (dev/plugin.ts, load), each
// declared by a type that isn't written by hand: the data modules by JsonModules
// (src/virtual-types.ts), which is also the only type the plugin can write them as; the others by
// the real types of what they re-export (@void/md's, Hono's, Zod's, this package's own).
declare module "virtual:void-fbtee/config" {
  const config: import("./virtual-types").JsonModules["virtual:void-fbtee/config"];
  export default config;
}
declare module "virtual:void-fbtee/catalogs" {
  /** One lazy loader per translated locale, each importing its virtual:void-fbtee/catalog/<locale>. */
  const catalogs: Record<
    string,
    () => Promise<{
      default: import("./virtual-types").JsonModules["virtual:void-fbtee/catalog/*"];
    }>
  >;
  export default catalogs;
}
declare module "virtual:void-fbtee/texts" {
  const texts: import("./virtual-types").JsonModules["virtual:void-fbtee/texts"];
  export default texts;
}
declare module "virtual:void-fbtee/hono-route" {
  /** Hono's route helper (hono/route), from the Hono Void runs on. Server only. */
  export const matchedRoutes: typeof import("hono/route").matchedRoutes;
}
declare module "virtual:void-fbtee/md-pages" {
  /** @void/md's own list of the app's markdown pages, or [] without @void/md. */
  const pages: typeof import("@void/md/pages").default;
  export default pages;
}
declare module "virtual:void-fbtee/zod" {
  /** The app's Zod 4: its `config` and its message sets by locale (dev/plugin.ts, zodMessages). */
  const zod:
    | {
        config: typeof import("zod/v4/core").config;
        sets: Record<string, import("zod/v4/core").$ZodErrorMap>;
        fallback: import("zod/v4/core").$ZodErrorMap;
      }
    | undefined;
  export default zod;
}
declare module "virtual:void-fbtee/dev" {
  /** `vp dev` only: the dev server's route for translating with Void's AI (ai.ts). Undefined in a build. */
  const dev:
    | { path: string; token: string; translate: typeof import("./ai").devTranslate }
    | undefined;
  export default dev;
}
declare module "virtual:void-fbtee/pages" {
  /**
   * The app's pages under pages/[lang]/ with no other parameter ("/[lang]/docs"): read by the
   * plugin (langPages) from the same PagePathMap in .void/routes.d.ts that LangPage is made from.
   */
  const pages: ReadonlyArray<import("./server").LangPage>;
  export default pages;
}
