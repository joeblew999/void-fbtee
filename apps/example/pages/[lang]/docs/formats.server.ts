import { defineHandler, type InferProps } from "void";
import type { SharedI18n } from "void-fbtee/middleware";
import { runAll } from "../../../lib/formats";

export type Props = InferProps<typeof loader>;

// Every row, run on the Worker with its own Intl, in the page's language.
export const loader = defineHandler((c) => {
  const { locale } = (c.get("shared" as never) as { i18n: SharedI18n }).i18n;
  return { worker: runAll(locale) };
});
