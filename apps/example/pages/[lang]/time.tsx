// SPIKE: Temporal values formatted on the server and in the browser must be identical.
import { Temporal } from "temporal-polyfill";
import { useShared } from "@void/react";
import type { Props } from "./time.server";

export default function TimePage({ now, booking, birthday, length }: Props) {
  const { i18n } = useShared() as { i18n: { locale: string } };
  const locale = i18n.locale;
  const at = Temporal.ZonedDateTime.from(booking);
  const today = Temporal.Instant.from(now).toZonedDateTimeISO(at.timeZoneId);
  const days = today.toPlainDate().until(at.toPlainDate()).days;
  return (
    <main>
      <p data-testid="booking">
        {at.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}
      </p>
      <p data-testid="birthday">
        {Temporal.PlainDate.from(birthday).toLocaleString(locale, { dateStyle: "long" })}
      </p>
      <p data-testid="length">
        {new Intl.DurationFormat(locale, { style: "long" }).format(Temporal.Duration.from(length))}
      </p>
      <p data-testid="relative">
        {new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day")}
      </p>
    </main>
  );
}
