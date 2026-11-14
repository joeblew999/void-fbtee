import { defineHead } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";

// Cached until the next deploy, in every language (Void's prerendering, as the Intl page): the
// sample PDF it shows is its own address (routes/samples/ticket/[lang].ts), printed when it's asked
// for.
export const prerender = true;
export const getPrerenderPaths = langParams;

// The heading and the intro's own strings, so they're translated once.
export const head = defineHead(() =>
  pageHead({
    title: fbs("PDFs", "Docs page title: the page about translated PDFs"),
    description: fbs(
      "An app can print any document as a PDF in its reader's language: a ticket, an invoice, a receipt, a report. This app prints each booking's ticket. Here is one, printed for this page's language, and what it takes, with the lines that do it.",
      "PDFs page introduction",
    ),
  }),
);
