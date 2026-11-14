# plans/translated-pdfs.md: translated PDF tickets, documented by the package and shown by the example

Status: proposed 2026-11-14, waiting for the user's OK.

## Why

People who book want a ticket they can keep, print or show at the door, in their own language. The
hard part is Arabic (letters joined, right to left) and Thai (no spaces, so lines must break between
words), with only the fonts already on the machine (the project's system-fonts rule: no font files).

## What the experiment showed (2026-11-14, `.vitest/pdf/`, git-ignored)

The same ticket printed in en-US, ar-EG and th-TH:

- **Cloudflare Browser Run** (headless Chrome, the `BROWSER` binding, `quickAction("pdf", { html })`)
  got all three right, with Cloudflare's own fonts: DejaVu Sans (Latin, Arabic) and Loma (Thai), as
  `pdffonts` lists them. About 1 s cold, 0.2–0.4 s warm; 20–70 KB per PDF. It needs compatibility date
  2026-03-24 or later and only works against the real service, in dev too (`remote: true`).
- **Takumi** (`takumi-pdf` 0.20.0) was right and faster but can't use the machine's fonts: ruled out.
- react-pdf (no right-to-left), pdf-lib and jsPDF (no letter joining), Typst (Thai line breaks):
  ruled out.

Limits (Cloudflare's Browser Run pricing page, checked 2026-11-14): free plan 10 browser minutes a
day and 3 browsers at once; paid 10 hours a month, then $0.09 an hour. At 0.3 s a ticket that is
about 2,000 tickets a day free.

## How it works

1. **Booking stays fast.** The booking action (`pages/[lang]/events/[id].server.ts`) keeps putting
   the row in, then sends `{ bookingId }` to a new queue, `queues/ticket.ts`, instead of sending the
   email itself. Printing takes up to a second and can fail or hit the 3-browser limit, so it
   shouldn't hold up the page; a queue gives retries for free (Void's guide/queues.md:
   `retryDelay`, `msg.attempts`).
2. **The consumer prints the ticket.** It reads the booking (its locale and time zone are already
   kept with it), renders the ticket with React in that locale with void-fbtee's `inLocale`, with
   `lang`/`dir` on `<html>` from `langAttrs` and the site's system font stack. Then it calls
   Browser Run and gets the PDF back.
3. **It keeps the PDF** in R2 through `void/storage` (guide/storage.md), under the booking's UUID,
   so it is printed once, not on every download.
4. **It sends the booking email with the PDF attached** (`ticket.pdf`, `application/pdf`;
   guide/email/sending.md "Attachments", 5 MiB limit, ours is under 100 KB). If printing still fails
   on the last try, the email goes without the attachment but with the download link, so nobody is
   left without a confirmation.
5. **Download.** `routes/api/tickets/[id].pdf.ts` serves the PDF from R2. The booking's UUID is the
   key, so only the person with the link can open it. The email links to it, and the event page shows
   "Download your ticket" after booking.

The ticket's layout is the email's (same logo, colours, theme), so the email, the page and the PDF
look like one thing.

## What goes where

- **Package (`packages/void-fbtee`):** probably no new code. What a translated PDF needs from i18n
  (`inLocale`, `langAttrs`, translated strings) the package already has. If the experiment code
  shows a helper that every app would write the same way, it goes in the package; otherwise not.
  The SKILL gains "Translated PDFs": the pattern, the system-fonts point, the Browser Run setup.
- **Example (`apps/example`):** the queue, the ticket component, the download route, the email
  attachment, the config (`browser: { binding: "BROWSER", remote: true }`, an R2 bucket, compat date
  2026-03-24).

## How it's documented and shown (the same way as emails)

- **Docs page `/[lang]/docs/pdfs`**, next to Emails in `DocsLayout.tsx`: the sample ticket shown
  as the real PDF in en/ar/th (embedded, with a download link), then a few points with the real
  code lines, as `emails.tsx` does. The sample is printed once per language and kept in R2, so
  visitors don't spend browser time.
- **Homepage:** a "PDF tickets" card in `HomeSections.tsx`.
- **Tour (`tour.md` en/ar/th):** a short PDFs section after emails.
- **README and SKILL:** the setup and the limits above.
- **The emails docs page** says the booking email carries the PDF.

## Email with a PDF, shown for real

- In dev it lands in Void's local inbox, where the attachment can be opened (guide/email/sending.md).
- I book an event on the live site in en, ar and th and send the three emails to you through
  Gmail, so you see the real thing in a real mail client.

## Tests (real services, no fakes)

- Unit: the ticket's HTML has the right `lang`/`dir` and text per locale.
- Dev (`test:dev`): a booking ends with an email in the local inbox carrying a PDF, and the
  download route returns the same PDF.
- Preview (`test:preview`): `/docs/pdfs` is in the page lists.

## Risks

- The compat date bump (2026-02-24 to 2026-03-24) can change Worker behaviour: I'll read
  Cloudflare's compatibility-flags list for that month before changing it.
- The free plan's 3 browsers at once: the queue's batch size will be kept small so a burst of
  bookings retries instead of failing.
