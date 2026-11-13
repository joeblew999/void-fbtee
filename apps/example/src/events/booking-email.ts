// The email confirming a booked seat, in the language of whoever booked it (kept with the booking,
// bookings.locale), not the page's: inLocale() from void-fbtee/server, which works with no request
// too, so the same code can run in a queue. Sent with Void's sendEmail (guide/email/sending.md):
// in dev it lands in Void's local inbox; on the live site it goes from email.from in void.config.ts,
// set up on Cloudflare by `void email setup` (guide/email/domains.md).
// sendEmail never throws, so a booking never fails because its email couldn't go.
import { fbs } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { sendEmail } from "void/email";
import { EMAIL_FROM } from "@/site";
import { langAttrs, type AppLocale } from "void-fbtee/locales";
import { inLocale } from "void-fbtee/server";

export type BookingEmail = { subject: string; text: string; html: string };

/** HTML text: its five special characters escaped. */
const html = (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * The email, written in `locale`: the event's title as the booker reads it (its translation, or as
 * written), its start on the clock where it happens, and its page's address in that language.
 */
export function bookingEmail(booking: {
  locale: AppLocale;
  name: string;
  title: string;
  titleLocale: string;
  startsAt: string;
  url: string;
}): Promise<BookingEmail> {
  return inLocale(booking.locale, ({ locale, dir }) => {
    const when = Temporal.ZonedDateTime.from(booking.startsAt).toLocaleString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const subject = String(
      fbs(
        ["Your seat at ", fbs.param("event", booking.title)],
        "Booking email subject: a seat is booked at this event",
      ),
    );
    const lines = [
      String(
        fbs(
          ["Hello ", fbs.param("name", booking.name), ","],
          "Booking email: greeting, with the name the booker gave",
        ),
      ),
      String(
        fbs(
          [
            "You have a seat at ",
            fbs.param("event", booking.title),
            ". It starts ",
            fbs.param("time", when),
            ".",
          ],
          "Booking email: the event, and when it starts on the clock where it happens",
        ),
      ),
      String(fbs("The event's page:", "Booking email: before the link to the event's page")),
    ];
    // In HTML the title is marked with its own language and direction, as on the site (a title
    // left as its organiser wrote it can be in another language than the email).
    const own = langAttrs(booking.titleLocale);
    const titled = (line: string) =>
      html(line).replace(
        html(booking.title),
        `<bdi lang="${own.lang}" dir="${own.dir}">${html(booking.title)}</bdi>`,
      );
    return {
      subject,
      text: [...lines, booking.url].join("\n\n") + "\n",
      html:
        `<div lang="${locale}" dir="${dir}">` +
        lines.map((l) => `<p>${titled(l)}</p>`).join("") +
        `<p><a href="${html(booking.url)}">${html(booking.url)}</a></p></div>`,
    };
  });
}

/** Writes the email in the booker's language and sends it; a failure is logged, not thrown. */
export async function sendBookingEmail(to: string, booking: Parameters<typeof bookingEmail>[0]) {
  const email = await bookingEmail(booking);
  const result = await sendEmail({ from: EMAIL_FROM, to, ...email });
  // The error's code only, never the address.
  if (!result.ok)
    console.warn(
      "booking email not sent:",
      "error" in result ? result.error.code : result.deliveries.map((d) => !d.ok && d.error.code),
    );
}
