// The data modules the plugin writes as JSON (dev/plugin.ts, jsonModule), each type stated once:
// the plugin can only write a value of this type, and src/virtual.d.ts declares each module by it,
// so what the plugin writes and what the code reads are the same type (plans/checked-everywhere.md).
import type { TranslationDictionary } from "fbtee";
import type { RuntimeConfig } from "./runtime";

export interface JsonModules {
  "virtual:void-fbtee/config": RuntimeConfig;
  /** Each string's source text by hash (empty in the browser's build). */
  "virtual:void-fbtee/texts": Record<string, string>;
  /** One language's catalog, `{ [locale]: fbtee's tables }`, or `{}` when it has none yet. */
  "virtual:void-fbtee/catalog/*": TranslationDictionary;
}
