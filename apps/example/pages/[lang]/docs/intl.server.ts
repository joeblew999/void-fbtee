import { defineHandler, type InferProps } from "void";
import { runAll } from "@/lib/intl";

export type Props = InferProps<typeof loader>;

// Every row, run on the Worker with its own Intl, in the page's language.
export const loader = defineHandler((c) => {
  const { locale } = c.get("i18n");
  return { worker: runAll(locale) };
});
