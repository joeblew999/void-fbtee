// The events' emails, each in its reader's language (inLocale() from void-fbtee/server, which works
// with no request too, so the same code runs in an action or a queue):
//   - a booking's confirmation, to whoever booked, in the language they booked in (bookings.locale);
//   - the private link, to whoever posted an event and asked for it, in the language they posted in;
//   - a cancellation, to everyone who booked, each in their own language (queues/cancel.ts);
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

export type Email = {
  subject: string;
  text: string;
  html: string;
  attachments: (typeof logoAttachment)[];
};

/** An event as one reader sees it: its title in their language (or as written), and its start. */
export type EventFor = {
  title: string;
  titleLocale: string;
  startsAt: string;
};

/** The event's start, on the clock where it happens, written the reader's way. */
const startsAt = (event: EventFor, locale: string) =>
  Temporal.ZonedDateTime.from(event.startsAt).toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

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
    attachments: [logoAttachment],
  };
}

/** A booking's confirmation, in `locale`: the event, when it starts, and its page in that language. */
export function bookingEmail(
  booking: EventFor & { locale: AppLocale; name: string; url: string },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Booking email: greeting, with the name the booker gave",
      ),
      fbs(
        [
          "You have a seat at ",
          fbs.param("event", booking.title),
          ". It starts ",
          fbs.param("time", startsAt(booking, locale)),
          ".",
        ],
        "Booking email: the event, and when it starts on the clock where it happens",
      ),
      fbs("The event's page:", "Booking email: before the link to the event's page"),
    ];
    const subject = fbs(
      ["Your seat at ", fbs.param("event", booking.title)],
      "Booking email subject: a seat is booked at this event",
    );
    return written(subject, lines, booking.url, booking, locale, dir);
  });
}

/** The poster's private link, in `locale`: the only way to delete their event later. */
export function linkEmail(post: EventFor & { locale: AppLocale; link: string }): Promise<Email> {
  return inLocale(post.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["You posted ", fbs.param("event", post.title), "."],
        "Private link email: the event the reader just posted",
      ),
      fbs(
        "Keep this email: the link below is the only way to delete your event later. Anyone with it can delete the event, so don't share it.",
        "Private link email: why to keep the link, and to keep it private",
      ),
    ];
    const subject = fbs(
      ["Your private link for ", fbs.param("event", post.title)],
      "Private link email subject: the link to delete the event the reader posted",
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
          ", on ",
          fbs.param("time", startsAt(booking, locale)),
          ", has been cancelled by its organiser. Your seat is gone with it.",
        ],
        "Cancellation email: the event the reader booked, and when it would have started, is cancelled",
      ),
      fbs("Other events:", "Cancellation email: before the link to the events list"),
    ];
    const subject = fbs(
      [fbs.param("event", booking.title), " is cancelled"],
      "Cancellation email subject: the event the reader booked is cancelled",
    );
    const events = booking.origin + routeUrl("/[lang]/events");
    return written(subject, lines, events, booking, locale, dir);
  });
}

/**
 * A reminder, in `locale`: the event starts within a day, at this time on its own clock; its page
 * in that language on the site at `origin`.
 */
export function reminderEmail(
  booking: EventFor & { locale: AppLocale; name: string; id: string; origin: string },
): Promise<Email> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const lines = [
      fbs(
        ["Hello ", fbs.param("name", booking.name), ","],
        "Reminder email: greeting, with the name the booker gave",
      ),
      fbs(
        [
          "A reminder: you have a seat at ",
          fbs.param("event", booking.title),
          ", which starts ",
          fbs.param("time", startsAt(booking, locale)),
          ".",
        ],
        "Reminder email: the event the reader booked starts within a day, and when",
      ),
      fbs("The event's page:", "Reminder email: before the link to the event's page"),
    ];
    const subject = fbs(
      ["Reminder: ", fbs.param("event", booking.title)],
      "Reminder email subject: the event the reader booked starts within a day",
    );
    const page = booking.origin + routeUrl("/[lang]/events/[id]", { params: { id: booking.id } });
    return written(subject, lines, page, booking, locale, dir);
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

export const sendCancellationEmail = (
  to: string,
  booking: Parameters<typeof cancellationEmail>[0],
) => send(to, cancellationEmail(booking), "cancellation");
