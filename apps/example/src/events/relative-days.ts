// "tomorrow", "in 44 days": calendar days from `from` to a time, counted in that time's own zone.
// App code, as fbtee's README says: "keep the locale, time zone, and reference time consistent
// between server and client; these settings belong to your application."
import { Temporal } from "temporal-polyfill";

export function relativeDays(locale: string, to: Temporal.ZonedDateTime, from: Temporal.Instant) {
  const today = from.toZonedDateTimeISO(to.timeZoneId).toPlainDate();
  const days = today.until(to.toPlainDate()).days;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
