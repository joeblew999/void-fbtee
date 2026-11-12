import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { runAll } from "@/lib/intl";

export type Props = InferProps<typeof loader>;

// Every row, run on the Worker with its own Intl, in the page's language.
export const loader = defineHandler((c) => {
  const { locale } = c.get("i18n");
  return { worker: runAll(locale) };
});

// The intro's own string as the description, so it's translated once.
export const head = defineHead(() => ({
  title: "Intl",
  meta: [
    {
      name: "description",
      content: String(
        fbs(
          "Each row is one call to the platform's own Intl, in this page's language. The Worker ran it before sending the page: that's the text this app's pages show. Your browser ran it again with its own engine.",
          "Intl page introduction",
        ),
      ),
    },
  ],
}));
