// SPIKE: Temporal values formatted on the server and in the browser must be identical.
import { Temporal } from "temporal-polyfill";
import { useLocale } from "void-fbtee/react";
import { relativeDays } from "../../lib/relative-days";
import type { Props } from "./time.server";

export default function TimePage({ booking, birthday, length }: Props) {
  const { locale, now } = useLocale();
  const at = Temporal.ZonedDateTime.from(booking);
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
      <p data-testid="relative">{relativeDays(locale, at, Temporal.Instant.from(now))}</p>
    </main>
  );
}
