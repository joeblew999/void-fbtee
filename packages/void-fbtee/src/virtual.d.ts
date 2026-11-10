// Modules the void-fbtee Vite plugin makes at the app's build time.
declare module "virtual:void-fbtee/config" {
  const config: import("./locales").LocaleConfig;
  export default config;
}
declare module "virtual:void-fbtee/catalogs" {
  /** One lazy loader per translated locale; each resolves to fbtee's translation table. */
  const catalogs: Record<string, () => Promise<{ default: Record<string, unknown> }>>;
  export default catalogs;
}
