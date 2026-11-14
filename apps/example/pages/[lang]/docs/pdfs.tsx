// The PDFs page, a reference: translated PDFs for any document an app prints, shown with this app's
// case, a booking's ticket (src/events/tickets.ts). The sample is the app's own ticket code printed
// by Cloudflare Browser Run for this page's language (routes/samples/ticket/[lang].ts), shown as a
// picture of its page (routes/samples/ticket-image/[lang].ts) that opens the PDF, and the
// points are what it takes, each with the lines that do it.
import { fbs, fbt } from "fbtee";
import { useLocale } from "void-fbtee/react";
import { DocsPage } from "@/docs/DocsPage";
import { Points, Section, SkillLink, type Point } from "@/docs/Points";

function points(): Point[] {
  return [
    {
      id: "browser",
      title: (
        <fbt desc="PDFs page point title: the PDF is printed by a real browser">
          Printed by a browser
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: a browser lays out every script right, so the PDF is a page of HTML printed by Cloudflare Browser Run">
          Arabic must be joined and read right to left, and Thai has no spaces, so its lines must
          break between words. A browser does all of it, so the PDF is a page of HTML, printed by
          Cloudflare Browser Run: Chrome on Cloudflare. PDF libraries that draw text themselves get
          one or the other wrong.
        </fbt>
      ),
      code: [{ file: "src/pdf.ts", line: 'const res = await browser.quickAction("pdf", {' }],
    },
    {
      id: "fonts",
      title: (
        <fbt desc="PDFs page point title: only the fonts already on the machine">
          Only the system's fonts
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: the page names the system font, as the site does, and Cloudflare's Chrome has fonts for every language, so no font files are shipped">
          The page names the system's font, as the whole site does, and Cloudflare's Chrome has
          fonts for Arabic, Thai and the rest, so the app ships no font files at all.
        </fbt>
      ),
      code: [{ file: "pages/style.css", line: "--font-sans: system-ui, sans-serif;" }],
    },
    {
      id: "language",
      title: (
        <fbt desc="PDFs page point title: the PDF is in its reader's language">
          In the reader's language
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: the PDF is made in the language saved with the booking, with void-fbtee's inLocale, its language and direction on the page, and text in another language marked">
          A PDF is made away from any page: in a queue, or for a download. void-fbtee's inLocale
          runs its code in the language saved with the booking, and the page carries that language
          and direction. An event's title in another language is marked with its own, as on the
          site.
        </fbt>
      ),
      code: [
        {
          file: "src/events/tickets.ts",
          line: "return inLocale(ticket.locale, ({ locale, dir }) =>",
        },
        { file: "src/events/TicketLayout.tsx", line: "<Html lang={locale} dir={dir}>" },
        { file: "src/events/TicketLayout.tsx", line: "{titled(heading, title)}" },
      ],
    },
    {
      id: "queue",
      title: (
        <fbt desc="PDFs page point title: the PDF is made after the page answers">
          Not while anyone waits
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: printing takes up to a second and can fail, so booking sends a message to a queue, whose consumer prints each ticket on its own and retries if it has to">
          Printing takes up to a second, and the browser can be busy, so booking only sends the
          booking's id to a queue. Its consumer prints each booking's ticket on its own, so one that
          fails is tried again a minute later without holding up the others.
        </fbt>
      ),
      code: [
        {
          file: "pages/[lang]/events/[id].server.ts",
          line: "await queues.ticket.send({ bookingId: body.id });",
        },
        { file: "queues/ticket.ts", line: "export const maxBatchSize = 1;" },
      ],
    },
    {
      id: "kept",
      title: (
        <fbt desc="PDFs page point title: each PDF is printed once and kept">
          Printed once, kept
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: each PDF is kept in R2 under the booking's random id, which is its private address">
          Each PDF is kept in R2, under the booking's id, so it's printed once however often it's
          opened. The id is random, so the ticket's address is known only to whoever booked.
        </fbt>
      ),
      code: [
        {
          file: "src/events/tickets.ts",
          line: 'await storage.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });',
        },
      ],
    },
    {
      id: "email",
      title: (
        <fbt desc="PDFs page point title: the PDF is attached to the booking's email">
          Attached to the email
        </fbt>
      ),
      why: (
        <fbt desc="PDFs page point: the ticket goes with the booking's confirmation email, in the same language">
          The ticket goes with the booking's confirmation, in the same language. If it still can't
          be printed on the last try, the email goes without it, and the ticket is printed when it's
          downloaded.
        </fbt>
      ),
      code: [
        {
          file: "src/events/emails.ts",
          line: '[{ filename: "ticket.pdf", content: booking.ticket, contentType: "application/pdf" }]',
        },
      ],
    },
    {
      id: "setup",
      title: <fbt desc="PDFs page point title: what to set up">Setting it up</fbt>,
      why: (
        <fbt desc="PDFs page point: the browser binding in void.config.ts, run on Cloudflare in development too, a compatibility date from 2026-03-24, and the free plan's limits">
          Browser Run is a binding in void.config.ts, run on Cloudflare in development too, through
          Void's Cloudflare sign-in. It needs a compatibility date of 2026-03-24 or later.
          Cloudflare's free plan gives 10 minutes of browser time a day: about two thousand tickets.
        </fbt>
      ),
      code: [
        { file: "void.config.ts", line: 'browser: { binding: "BROWSER", remote: true },' },
        { file: "void.config.ts", line: 'compatibility_date: "2026-03-24",' },
      ],
    },
  ];
}

export default function PdfsPage() {
  const { locale } = useLocale();
  const sample = `/samples/ticket/${locale}`;
  const sections = [
    {
      id: "sample",
      title: (
        <fbt desc="PDFs page section title: the sample PDF, printed for this page's language">
          A ticket, printed for this page
        </fbt>
      ),
    },
    {
      id: "how",
      title: (
        <fbt desc="PDFs page section title: what a translated PDF needs">
          What a translated PDF needs
        </fbt>
      ),
    },
  ];
  return (
    <DocsPage
      testId="pdfs-title"
      title={<fbt desc="Docs page title: the page about translated PDFs">PDFs</fbt>}
      intro={
        <fbt desc="PDFs page introduction">
          An app can print any document as a PDF in its reader's language: a ticket, an invoice, a
          receipt, a report. This app prints each booking's ticket. Here is one, printed for this
          page's language, and what it takes, with the lines that do it.
        </fbt>
      }
      sections={sections}
    >
      <Section id={sections[0].id} title={sections[0].title}>
        <p className="text-muted-foreground">
          <fbt desc="PDFs page: the sample is the app's own ticket, for a sample booking, printed by Browser Run in this page's language">
            The app's own ticket for a sample booking, Laila's seat at an evening of Arabic
            calligraphy, printed by Browser Run in this page's language. Open it in the other
            languages from the menu.
          </fbt>
        </p>
        {/* A picture of the PDF's page, made from the same page, as every phone shows a picture and
            not all show a PDF inside a page; it opens the PDF itself. */}
        <a href={sample} data-testid="pdf-sample-link" className="block max-w-sm">
          <img
            src={`/samples/ticket-image/${locale}`}
            width={559}
            height={794}
            alt={fbs(
              "The sample ticket",
              "PDFs page: description of the picture of the sample PDF ticket",
            )}
            data-testid="pdf-sample"
            className="h-auto w-full rounded-lg border"
          />
        </a>
        <p>
          <a href={sample} className="underline">
            <fbt desc="PDFs page: link that opens the sample PDF on its own">Open the PDF</fbt>
          </a>
        </p>
      </Section>
      <Section id={sections[1].id} title={sections[1].title}>
        <Points points={points()} />
        <SkillLink section="translated-pdfs" />
      </Section>
    </DocsPage>
  );
}
