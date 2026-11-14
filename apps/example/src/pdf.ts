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

/**
 * The page printed as a PDF. The page sets its own paper size (CSS `@page { size: … }`), its
 * language and direction (`<html lang dir>`), and its colours, which are printed as they are.
 */
export async function printPdf(browser: BrowserRun, html: string): Promise<Uint8Array> {
  const res = await browser.quickAction("pdf", {
    html,
    pdfOptions: { preferCSSPageSize: true, printBackground: true },
  });
  if (!res.ok) throw new PrintError(`Browser Run answered ${res.status}: ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}
