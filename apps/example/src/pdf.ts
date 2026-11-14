// A PDF from a page of HTML, printed by Cloudflare Browser Run: headless Chrome on Cloudflare,
// the BROWSER binding (void.config.ts). Chrome lays out every script the way a browser does
// (Arabic joined and right to left, Thai broken between words) with the fonts already on
// Cloudflare's machines, so the HTML names only system fonts and the app ships none. Checked
// 2026-11-14 with en-US, ar-EG and th-TH: the PDFs embed DejaVu Sans (Latin, Arabic) and Loma
// (Thai); about a second for the first, 0.2-0.4 s after (plans/translated-pdfs.md).
//
// Its cost is browser time: Cloudflare's free plan allows 10 minutes a day and 3 browsers at once,
// so a PDF is printed once and kept, never on every download (src/events/tickets.ts).

/** Thrown when Browser Run doesn't give a PDF back: the caller retries (a queue) or answers 503. */
export class PrintError extends Error {}

/** A Browser Run quick action's result as bytes, or PrintError. */
async function quick(action: Promise<Response>): Promise<Uint8Array> {
  const res = await action;
  if (!res.ok) throw new PrintError(`Browser Run answered ${res.status}: ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The page printed as a PDF. The page sets its own paper size (CSS `@page { size: … }`), its
 * language and direction (`<html lang dir>`), and its colours, which are printed as they are.
 */
export const printPdf = (browser: BrowserRun, html: string) =>
  quick(
    browser.quickAction("pdf", {
      html,
      pdfOptions: { preferCSSPageSize: true, printBackground: true },
    }),
  );

/**
 * The same page as a picture of its first page (WebP), for where a PDF can't be shown inside a page
 * (phones): A5 at 96 dpi (148 x 210 mm is 559 x 794 px), twice as sharp.
 */
export const printImage = (browser: BrowserRun, html: string) =>
  quick(
    browser.quickAction("screenshot", {
      html,
      viewport: { width: 559, height: 794, deviceScaleFactor: 2 },
      screenshotOptions: { type: "webp", quality: 85 },
    }),
  );

/**
 * A route's answer with what `print` gives: the bytes with `headers`; 503 with retry-after when
 * Browser Run can't print it now; undefined when there's nothing to print (the route's 404).
 */
export async function printedResponse(
  what: string,
  print: () => Promise<Uint8Array | undefined>,
  headers: Record<string, string>,
): Promise<Response | undefined> {
  let bytes: Uint8Array | undefined;
  try {
    bytes = await print();
  } catch (error) {
    if (!(error instanceof PrintError)) throw error;
    console.warn(`${what} not printed:`, error.message);
    return new Response(`The ${what} can't be printed right now. Try again in a minute.`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "60" },
    });
  }
  return bytes && new Response(bytes.slice().buffer, { headers });
}
