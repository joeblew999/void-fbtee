// The events' emails, each in its reader's language (inLocale() from void-fbtee/server, which works
// with no request too, so the same code runs in an action or a queue):
//   - a booking's confirmation, to whoever booked, in the language they booked in (bookings.locale);
//   - the private link, to whoever posted an event and asked for it, in the language they posted in;
//   - a cancellation, to everyone who booked, each in their own language (queues/cancel.ts);
//   - a change its organiser made to the title, the time or the place, to everyone who booked, each
//     in their own language (queues/change.ts);
//   - a reminder, the day before, to everyone who booked, each in their own (crons/reminders.ts).
// Each links to the site it was made on (dev, a Worker Preview, live), not the canonical address.
// Sent with Void's sendEmail (guide/email/sending.md): in dev it lands in Void's local inbox; on the
// live site it goes from EMAIL_FROM (email.from in void.config.ts), set up on Cloudflare by `void
// email setup` (guide/email/domains.md). sendEmail never throws, so booking, posting or deleting
// never fails because an email couldn't go.
import { fbs } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { sendEmail } from "void/email";
import { EMAIL_FROM } from "@/site";
import { langAttrs, type AppLocale } from "void-fbtee/locales";
import { routeUrl } from "void-fbtee/routes";
import { inLocale } from "void-fbtee/server";
import { emailHtml, logoAttachment } from "./EmailLayout";
import { formatWhen } from "./event-clock";

/** A file sent with an email: the logo, shown inside it, or a booking's PDF ticket, attached. */
type Attachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
  contentId?: string;
  disposition?: "inline" | "attachment";
};

/** A booking's PDF ticket, attached as ticket.pdf, and the line that says so; none without one. */
function withTicket(ticket: Uint8Array | undefined) {
  if (!ticket) return { line: [], attachments: [] };
  return {
    line: [fbs("Your ticket is attached.", "Email: the booking's PDF ticket is attached to it")],
    attachments: [{ filename: "ticket.pdf", content: ticket, contentType: "application/pdf" }],
  };
}

export type Email = {
  subject: string;
  text: string;
  html: string;
  attachments: Attachment[];
};

/**
 * An event as one reader sees it: its title in their language (or as written), and its start and
 * end (as stored: Temporal's text on the event's own clock).
 */
export type EventFor = {
  title: string;
  titleLocale: string;
  startsAt: string;
  endsAt: string;
};

/**
 * When the event is, from its start to its end, on the clock where it happens, written the
 * reader's way: "Saturday 6 March, 6:30 – 9:30 pm GMT+7" (event-clock.ts formatWhen, which says
 * the day once when it's the same).
 */
export const during = (event: { startsAt: string; endsAt: string }, locale: string) => {
  const start = Temporal.ZonedDateTime.from(event.startsAt);
  const end = Temporal.ZonedDateTime.from(event.endsAt);
  return formatWhen(locale, start.epochMilliseconds, end.epochMilliseconds, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: start.timeZoneId,
  });
};

/**
 * The email from its lines and closing link: the plain text as the lines and the link, and the HTML
 * in the site's look (EmailLayout.tsx), in the email's own language and direction, with the event's
 * title marked in its own (a title left as its organiser wrote it can be in another language than
 * the email), as on the site. A last line that introduces the link ("The event's page:") becomes
 * the button's label in the HTML; without one (the private link), the link is shown whole.
 */
async function written(
  subject: string,
  lines: string[],
  link: string,
  event: EventFor,
  locale: string,
  dir: string,
  attachments: Attachment[] = [],
): Promise<Email> {
  const last = lines.at(-1) ?? "";
  const intro = /[:：]\s*$/.test(last);
  const html = await emailHtml({
    locale,
    dir,
    subject,
    lines: intro ? lines.slice(0, -1) : lines,
    link,
    label: intro ? last.replace(/\s*[:：]\s*$/, "") : undefined,
    title: { text: event.title, ...langAttrs(event.titleLocale) },
  });
  return {
    subject,
    text: [...lines, link].join("\n\n") + "\n",
    html,
    attachments: [logoAttachment, ...attachments],
  };
}

/**
 * A booking's confirmation, in `locale`: the event, when it starts, and its page in that language;
 * with its PDF ticket attached when there is one (queues/ticket.ts).
 */
export function bookingEmail(
  booking: EventFor & { locale: AppLocale; name: string; url: string; ticket?: Uint8Array },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const ticket = withTicket(booking.ticket);
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Booking email: greeting, with the name the booker gave",
      ),
      fbs(
        [
          "You have a seat at ",
          fbs.param("event", booking.title),
          ", ",
          fbs.param("time", during(booking, locale)),
          ".",
        ],
        "Booking email: the reader has a seat at an event; {event} is the event's title, {time} when it is, from its start to its end on the clock where it happens, already formatted",
      ),
      ...ticket.line,
      fbs("The event's page:", "Booking email: before the link to the event's page"),
    ];
    const subject = fbs(
      ["Your seat at ", fbs.param("event", booking.title)],
      "Booking email subject: the reader has booked a seat at an event; {event} is the event's title",
    );
    return written(subject, lines, booking.url, booking, locale, dir, ticket.attachments);
  });
}

/** The poster's private link, in `locale`: the only way to change or delete their event later. */
export function linkEmail(post: EventFor & { locale: AppLocale; link: string }): Promise<Email> {
  return inLocale(post.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["You posted ", fbs.param("event", post.title), "."],
        "Private link email: the reader has just posted an event; {event} is its title",
      ),
      fbs(
        "Keep this email: the link below is the only way to change or delete your event later. Anyone with it can change or delete the event, so don't share it.",
        "Private link email: why to keep the link, and to keep it private",
      ),
    ];
    const subject = fbs(
      ["Your private link for ", fbs.param("event", post.title)],
      "Private link email subject: the private link to delete the event the reader posted; {event} is its title",
    );
    return written(subject, lines, post.link, post, locale, dir);
  });
}

/**
 * A cancellation, in `locale`: the event, when it would have started, and the events list in that
 * language on the site at `origin`.
 */
export function cancellationEmail(
  booking: EventFor & { locale: AppLocale; name: string; origin: string },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Cancellation email: greeting, with the name the booker gave",
      ),
      fbs(
        [
          fbs.param("event", booking.title),
          ", ",
          fbs.param("time", during(booking, locale)),
          ", has been cancelled by its organiser. Your seat is gone with it.",
        ],
        "Cancellation email: the event the reader had a seat at is cancelled by its organiser; {event} is its title, {time} when it would have been, from its start to its end, already formatted",
      ),
      fbs("Other events:", "Cancellation email: before the link to the events list"),
    ];
    const subject = fbs(
      [fbs.param("event", booking.title), " is cancelled"],
      "Cancellation email subject: the event the reader had a seat at is cancelled; {event} is its title",
    );
    const events = booking.origin + routeUrl("/[lang]/events");
    return written(subject, lines, events, booking, locale, dir);
  });
}

/**
 * A change, in `locale`: the event's organiser changed what matters to someone with a seat (its
 * title, when it starts, where), and what it is now: its start then and now, on the clock where it
 * happens; its place now; and its page in that language on the site at `origin`, where the ticket
 * is printed again with the new details.
 */
export function changeEmail(
  booking: EventFor & {
    locale: AppLocale;
    name: string;
    id: string;
    origin: string;
    venue: string | null;
    was: { startsAt?: string; endsAt?: string; venue?: string | null };
  },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Change email: greeting, with the name the booker gave",
      ),
      fbs(
        ["The organiser of ", fbs.param("event", booking.title), " has changed it."],
        "Change email: the organiser of the event the reader has a seat at changed it; {event} is its title as it is now",
      ),
    ];
    if (booking.was.startsAt || booking.was.endsAt) {
      const before = {
        startsAt: booking.was.startsAt ?? booking.startsAt,
        endsAt: booking.was.endsAt ?? booking.endsAt,
      };
      lines.push(
        fbs(
          [
            "It's now ",
            fbs.param("time", during(booking, locale)),
            ", not ",
            fbs.param("before", during(before, locale)),
            ".",
          ],
          "Change email: when the event is now; {time} is its new start to end and {before} what it was, both already formatted",
        ),
      );
    }
    if (booking.was.venue !== undefined)
      lines.push(
        booking.venue
          ? fbs(
              ["It's now at ", fbs.param("venue", booking.venue), "."],
              "Change email: where the event is now; {venue} is the place, as its organiser wrote it",
            )
          : fbs(
              "It no longer says where it is: see its page.",
              "Change email: the organiser removed the event's place",
            ),
      );
    lines.push(
      fbs(
        "Your seat is kept. Your ticket, with the new details, is on the event's page:",
        "Change email: the reader's seat is kept; before the link to the event's page, where the ticket can be downloaded again",
      ),
    );
    const subject = fbs(
      [fbs.param("event", booking.title), " has changed"],
      "Change email subject: the organiser changed the event the reader has a seat at; {event} is its title as it is now",
    );
    const page = booking.origin + routeUrl("/[lang]/events/[id]", { params: { id: booking.id } });
    return written(subject, lines, page, booking, locale, dir);
  });
}

/**
 * A reminder, in `locale`: the event starts within a day, at this time on its own clock; its page
 * in that language on the site at `origin`; with the PDF ticket attached again when the booker
 * asked for it (crons/reminders.ts).
 */
export function reminderEmail(
  booking: EventFor & {
    locale: AppLocale;
    name: string;
    id: string;
    origin: string;
    ticket?: Uint8Array;
  },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const ticket = withTicket(booking.ticket);
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Reminder email: greeting, with the name the booker gave",
      ),
      fbs(
        [
          "A reminder: you have a seat at ",
          fbs.param("event", booking.title),
          ", ",
          fbs.param("time", during(booking, locale)),
          ".",
        ],
        "Reminder email: the event the reader has a seat at starts within a day; {event} is its title, {time} when it is, from its start to its end, already formatted",
      ),
      ...ticket.line,
      fbs("The event's page:", "Reminder email: before the link to the event's page"),
    ];
    const subject = fbs(
      ["Reminder: ", fbs.param("event", booking.title)],
      "Reminder email subject: the event the reader has a seat at starts within a day; {event} is its title",
    );
    const page = booking.origin + routeUrl("/[lang]/events/[id]", { params: { id: booking.id } });
    return written(subject, lines, page, booking, locale, dir, ticket.attachments);
  });
}

/** Sends an email; a failure is logged with its code only (never the address), not thrown. */
async function send(to: string, email: Promise<Email>, what: string) {
  const result = await sendEmail({ from: EMAIL_FROM, to, ...(await email) });
  if (!result.ok)
    console.warn(
      `${what} email not sent:`,
      "error" in result ? result.error.code : result.deliveries.map((d) => !d.ok && d.error.code),
    );
  return result.ok;
}

export const sendBookingEmail = (to: string, booking: Parameters<typeof bookingEmail>[0]) =>
  send(to, bookingEmail(booking), "booking");

export const sendLinkEmail = (to: string, post: Parameters<typeof linkEmail>[0]) =>
  send(to, linkEmail(post), "private link");

export const sendReminderEmail = (to: string, booking: Parameters<typeof reminderEmail>[0]) =>
  send(to, reminderEmail(booking), "reminder");

export const sendChangeEmail = (to: string, booking: Parameters<typeof changeEmail>[0]) =>
  send(to, changeEmail(booking), "change");

export const sendCancellationEmail = (
  to: string,
  booking: Parameters<typeof cancellationEmail>[0],
) => send(to, cancellationEmail(booking), "cancellation");
