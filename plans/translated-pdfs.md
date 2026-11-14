# plans/translated-pdfs.md: translated PDFs, documented by the package and shown by the example

Status: approved by the user 2026-11-14 and done the same day (committed locally).

## Why

The feature is translated PDFs, for any document an app prints (tickets, invoices, receipts,
reports). The docs, homepage, tour, SKILL and README call it "PDFs" or "Translated PDFs", never
"tickets". The example's case is the booking ticket, the way the Emails page uses the booking
email as its sample.

In the example, people who book want a ticket they can keep, print or show at the door, in their own language. The
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

- **Docs page `/[lang]/docs/pdfs`**, titled "PDFs", next to Emails in `DocsLayout.tsx`: written for
  any PDF an app makes, with the example's ticket as the sample, shown
  as the real PDF in en/ar/th (embedded, with a download link), then a few points with the real
  code lines, as `emails.tsx` does. The sample is printed once per language and kept in R2, so
  visitors don't spend browser time.
- **Homepage:** a "PDFs" card (what any app can print, translated) in `HomeSections.tsx` whose "Read more" link goes to the new
  docs page (`href: routeUrl("/[lang]/docs/pdfs")`, as the Emails card links to `/docs/emails`).
  The card grid's comment says "seven features"; it becomes eight.
- **Tour (`tour.md` en/ar/th):** a short PDFs section after emails.
- **README and SKILL:** the setup and the limits above.
- **The emails docs page** says the booking email carries the PDF.

## Every homepage card links to a docs page on this site

Approved 2026-11-14 with this plan. Today five of the seven cards in `src/home/HomeSections.tsx`
`features()` don't link to a page of their own on this site:

| Card                              | Links to now                       | Becomes                              |
| --------------------------------- | ---------------------------------- | ------------------------------------ |
| Strings, by fbtee                 | SKILL on GitHub, `#strings`        | new `/[lang]/docs/strings`           |
| Dates and times, by Temporal      | `/docs/tour`                       | the existing `/[lang]/docs/temporal` |
| Markdown pages, translated        | SKILL on GitHub, `#markdown-pages` | new `/[lang]/docs/markdown`          |
| Translated by AI, checked by you  | SKILL on GitHub (top)              | new `/[lang]/docs/translating`       |
| Every language, right to left too | SKILL on GitHub, `#strings`        | new `/[lang]/docs/right-to-left`     |

Each new page is built like the Intl, Temporal and Emails pages: what it does, shown working on
this site, with the real code lines, and a link on to the SKILL for the full reference. They join
the Reference group in `DocsLayout.tsx`. The PDFs card makes eight, all linking to this site.

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

## As built (2026-11-14)

Where it differs from the plan above:

- **The booking's id comes from the form** (a random UUID the browser makes, `bookSchema`), so the
  page knows the ticket's address the moment it's booked, with no redirect.
- **Download at `/tickets/<id>`** (`routes/tickets/[id].ts`), not under `/api`; it prints the
  ticket itself if the queue hasn't yet, so it always works.
- **The docs' sample** is its own route, `/samples/ticket/<language>`, kept in R2 under a hash of its
  HTML, so a change to the ticket's look or words prints it again.
- **Deleting an event deletes its tickets** from R2: each has its booker's name on it.
- **The ticket has the email's look** (the site's dark palette, through `email-theme.ts`) on an A5
  page, rendered with React Email as the emails are (`src/events/TicketLayout.tsx`).
- **`tsconfig.json`** now lists `.void/bindings.d.ts` with Void's other generated files, so
  `c.env.BROWSER` is typed (its `files` replaced the list Void generates, leaving it out).
- **The real email:** shown before deploying, the three booking emails (en, ar, th) as the app made
  them on the dev server, their PDFs printed by the real Browser Run, were sent to the user's inbox
  through Gmail. The live site sends its own once deployed.
- **Every homepage card links to its own docs page:** new Strings, Markdown pages, Right to left
  and Translating pages, with the PDFs page; the Temporal card links to the Temporal page.

### Fixes after review (2026-11-14, approved by the user)

- The PDFs page no longer says the queue prints "one booking at a time": `maxBatchSize = 1` puts one
  booking in each batch, but Cloudflare can run batches side by side, and Void has no setting to
  stop that. It now says each booking's ticket is printed and retried on its own.
- A booking id that's already taken is refused (400), not a crash.
- The PDFs page shows the sample as a picture of its page (Browser Run's screenshot, kept in R2
  like the PDF, at `/samples/ticket-image/<language>`), opening the PDF: Android Chrome doesn't show
  a PDF inside a page.
- **Reminder option:** the booking form has "Attach my ticket to the reminder the day before too"
  (`bookings.ticket_in_reminder`, migration `20261114052207_mighty_screwball.sql`). The reminder
  cron attaches the ticket kept in R2, so no printing.

### Second review (2026-11-14, approved by the user)

- **The preview's "translation failed, retried":** D1 refused the translations with a foreign-key
  error: the event had been deleted while Workers AI was translating it (a preview test posts and
  deletes at once). The translate queue now acks when the event is gone, and logs D1's own reason
  (the error's cause) for any other failure. The preview log is clean.
- **Tickets are deleted a week after their event started,** by the daily job, and not printed again
  after that (each has the booker's name).
- **A race left tickets behind:** the ticket queue could store a ticket just after its event was
  deleted. It now deletes one whose booking is gone, and sends no email for it; the dev test
  checks no ticket is left after deleting an event.
- **The docs' samples:** they link to the live site wherever they're made, so dev and the preview
  share one version, and the earlier versions are deleted.
- The sample picture's translator note says it's a picture.

Tests run: `test:unit`, `test:dev` (the Thai booking's email carries the PDF, and the page's
download link gives the same bytes), `test:preview` (every page in the lists, the PDFs page's sample
is a PDF, an unknown ticket is a 404). All passed.
