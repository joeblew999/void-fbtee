// What each stage's setup hands its tests (`project.provide` in dev/, preview/ and deployed/
// setup.ts, read with `inject`), typed the way Vitest documents: by adding to its ProvidedContext.
// Both sides are then checked against this one list, with no cast at either end.
declare module "vitest" {
  export interface ProvidedContext {
    /** The address under test: the dev server, the preview, or the live site. */
    prod: string;
    /** Whether that is the live site (tests that post or book skip themselves there). Preview's. */
    live?: boolean;
    /** Void's dev trigger token, for `/__void/*` hooks. The dev stage's. */
    devToken?: string;
    /** Why the dev tests skip, or "" when they run. The dev stage's. */
    devSkip?: string;
  }
}
export {};
