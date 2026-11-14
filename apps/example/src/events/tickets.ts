// A booking's PDF ticket, in the language the booking was made in (inLocale, as its email), and
// where it's kept. Printed once by Browser Run (src/pdf.ts) and kept in R2 through Void's storage
// (guide/storage.md), under the booking's id: the queue that emails it prints it
// (queues/ticket.ts), and a download prints it only if the queue hasn't yet
// (routes/tickets/[id].ts). The booking's id is a random UUID, so its ticket's address is known
// only to whoever booked. Deleting the event deletes its tickets (pages/[lang]/events/[id].server.ts).
//
// The Emails and PDFs pages' sample ticket is printed the same way, kept under a hash of its HTML:
// printed again only when the ticket's look or words change.
import { bookings, event_texts, events } from "@schema";
import { fbs } from "fbtee";
import { and, db, eq, inArray } from "void/db";
import { storage } from "void/storage";
import { langAttrs, type AppLocale } from "void-fbtee/locales";
import { routeUrl } from "void-fbtee/routes";
import { inLocale, pickText, textLocales } from "void-fbtee/server";
import { SAMPLE_EVENT, SAMPLE_ID, SAMPLE_NAME } from "@/docs/sample-event";
import { SITE } from "@/site";
import { printPdf } from "@/pdf";
import { startsAt, type EventFor } from "./emails";
import { ticketHtml } from "./TicketLayout";

/** What a ticket shows: the event as the booker reads it, who booked, and the event's page. */
export type TicketFor = EventFor & { locale: AppLocale; name: string; url: string };

/** The ticket's page of HTML, in the booking's language. */
export function ticketPage(ticket: TicketFor): Promise<string> {
  return inLocale(ticket.locale, ({ locale, dir }) =>
    ticketHtml({
      locale,
      dir,
      // The booking email's subject: the same words, translated once.
      heading: fbs(
        ["Your seat at ", fbs.param("event", ticket.title)],
        "Booking email subject: a seat is booked at this event",
      ),
      title: { text: ticket.title, ...langAttrs(ticket.titleLocale) },
      rows: [
        {
          label: fbs("Name", "PDF ticket: label of the name the booker gave"),
          value: ticket.name,
        },
        {
          label: fbs("Starts", "PDF ticket: label of when the event starts, on its own clock"),
          value: startsAt(ticket, locale),
        },
      ],
      note: fbs(
        "Show this ticket at the door, on your phone or printed.",
        "PDF ticket: what to do with the ticket",
      ),
      link: {
        label: fbs("The event's page:", "Booking email: before the link to the event's page"),
        url: ticket.url,
      },
    }),
  );
}

/**
 * A booking as its email and ticket need it: who booked and where to send it, the event's title in
 * the booking's language (else as written), and the event's page on the site it was booked on.
 * Undefined when there's no such booking (its event was deleted since).
 */
export async function bookingTicket(id: string) {
  const [row] = await db
    .select({ booking: bookings, event: events })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.event_id))
    .where(eq(bookings.id, id));
  if (!row) return undefined;
  const { booking, event } = row;
  const locale = booking.locale as AppLocale;
  const texts = await db
    .select()
    .from(event_texts)
    .where(
      and(eq(event_texts.event_id, event.id), inArray(event_texts.locale, textLocales(locale))),
    );
  const text = pickText(texts, locale);
  const page = await inLocale(locale, () =>
    routeUrl("/[lang]/events/[id]", { params: { id: event.id } }),
  );
  const ticket: TicketFor = {
    locale,
    name: booking.name,
    title: text?.title ?? event.title,
    titleLocale: text?.locale ?? event.locale,
    startsAt: event.starts_at,
    url: (booking.origin || SITE) + page,
  };
  return { email: booking.email, ticket };
}

/** Where a booking's ticket is kept in R2. */
export const ticketKey = (id: string) => `tickets/${id}.pdf`;

/** The PDF kept under `key`, or else printed from the page `html()` gives and kept there; undefined
 * when `html()` has no page to give. */
async function kept(key: string, html: () => Promise<string | undefined>, browser: BrowserRun) {
  const found = await storage.get(key);
  if (found) return new Uint8Array(await found.arrayBuffer());
  const page = await html();
  if (page === undefined) return undefined;
  const pdf = await printPdf(browser, page);
  await storage.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
  return pdf;
}

/** A booking's ticket as a PDF (kept, or printed now and kept), or undefined: no such booking. */
export const ticketPdf = (id: string, browser: BrowserRun) =>
  kept(
    ticketKey(id),
    async () => {
      const booking = await bookingTicket(id);
      return booking && ticketPage(booking.ticket);
    },
    browser,
  );

/** The docs' sample ticket in `locale`: Laila's seat at the calligraphy evening. */
export async function samplePdf(locale: AppLocale, origin: string, browser: BrowserRun) {
  const page = await inLocale(locale, () =>
    routeUrl("/[lang]/events/[id]", { params: { id: SAMPLE_ID } }),
  );
  const html = await ticketPage({ ...SAMPLE_EVENT, locale, name: SAMPLE_NAME, url: origin + page });
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html)),
  );
  const short = [...hash.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return kept(`tickets/sample/${locale}-${short}.pdf`, async () => html, browser);
}
