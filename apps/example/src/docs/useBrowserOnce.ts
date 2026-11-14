// Work something out once in the browser: null while hydrating (the server sent nothing), then the
// result, kept under `key` for as long as the page is open. The Intl and Temporal pages run their
// rows this way.
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const kept = new Map<string, unknown>();

export function useBrowserOnce<T>(key: string, make: () => T): T | null {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      if (!kept.has(key)) kept.set(key, make());
      return kept.get(key) as T;
    },
    () => null,
  );
}
