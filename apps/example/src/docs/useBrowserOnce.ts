// Work something out once in the browser: null while hydrating (the server sent nothing), then the
// result, kept by the component for its `key` (worked out again when the key changes: another
// language). The Intl and Temporal pages run their rows this way. Kept in the component, so the
// result keeps its own type (one shared map of every page's results could only be read back by
// a cast).
import { useRef, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function useBrowserOnce<T>(key: string, make: () => T): T | null {
  const kept = useRef<{ key: string; value: T } | null>(null);
  return useSyncExternalStore(
    noSubscribe,
    () => {
      let entry = kept.current;
      if (entry?.key !== key) {
        entry = { key, value: make() };
        kept.current = entry;
      }
      return entry.value;
    },
    () => null,
  );
}
