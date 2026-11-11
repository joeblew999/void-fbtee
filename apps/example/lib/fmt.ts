// The text for a <Fmt> value (components/Fmt.tsx), in one language: plain Intl, no React, so the
// tests format each value the same way the page does.
import { Temporal } from "temporal-polyfill";
import { relativeDays } from "./relative-days";

export type FmtProps = {
  num?: string;
  money?: string;
  currency?: string;
  when?: string;
  yours?: string;
  ago?: string;
  langs?: string;
};

const WHEN: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" };

/** The text for one value: `zone` is the reader's, `now` (an ISO instant) what "ago" counts from. */
export function fmt(p: FmtProps, locale: string, zone: string, now: string): string {
  if (p.num) return new Intl.NumberFormat(locale).format(Number(p.num));
  if (p.money)
    return new Intl.NumberFormat(locale, { style: "currency", currency: p.currency }).format(
      Number(p.money),
    );
  const at = (iso: string, timeZone?: string) => {
    const start = Temporal.ZonedDateTime.from(iso);
    return new Intl.DateTimeFormat(locale, {
      ...WHEN,
      timeZone: timeZone ?? start.timeZoneId,
    }).format(start.epochMilliseconds);
  };
  if (p.when) return at(p.when);
  if (p.yours) return at(p.yours, zone);
  if (p.ago)
    return relativeDays(
      locale,
      Temporal.ZonedDateTime.from(p.ago).withTimeZone(zone),
      Temporal.Instant.from(now),
    );
  if (p.langs) {
    const names = new Intl.DisplayNames(locale, { type: "language" });
    return new Intl.ListFormat(locale).format(p.langs.split(",").map((l) => names.of(l)!));
  }
  return "";
}
