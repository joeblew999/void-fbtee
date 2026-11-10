// SPIKE: Temporal values formatted on the server and in the browser must be identical.
import { Temporal } from "temporal-polyfill";
import { useIntl } from "void-fbtee/react";
import type { Props } from "./time.server";

export default function TimePage({ booking, birthday, length }: Props) {
  const intl = useIntl();
  const at = Temporal.ZonedDateTime.from(booking);
  return (
    <main>
      <p data-testid="booking">{intl.date(at, { dateStyle: "full", timeStyle: "short" })}</p>
      <p data-testid="birthday">
        {intl.date(Temporal.PlainDate.from(birthday), { dateStyle: "long" })}
      </p>
      <p data-testid="length">{intl.duration(length, { style: "long" })}</p>
      <p data-testid="relative">{intl.relativeDays(at)}</p>
    </main>
  );
}
