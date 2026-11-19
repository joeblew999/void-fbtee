// An event's start broken into the pieces the events board shows, in the page's language: the
// date on the place's clock (weekday, day, month), the time, and the place's clock by name
// ("Thailand Time", "توقيت تايلاند", "เวลาไทย"), all from Intl, so no list of cities to translate.
import { Temporal } from "temporal-polyfill";

export type ClockParts = {
  weekday: string;
  day: string;
  month: string;
  time: string;
  zone: string;
};

const part = (parts: Array<Intl.DateTimeFormatPart>, type: Intl.DateTimeFormatPartTypes) =>
  parts.find((p) => p.type === type)?.value ?? "";

/** The start, as the board shows it, on the clock of `timeZone` (the place's, or the reader's). */
export function clockParts(startsAt: string, locale: string, timeZone?: string): ClockParts {
  const start = Temporal.ZonedDateTime.from(startsAt);
  const zone = timeZone ?? start.timeZoneId;
  const at = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: zone }).formatToParts(
      start.epochMilliseconds,
    );
  const date = at({ weekday: "short", day: "2-digit", month: "short" });
  return {
    weekday: part(date, "weekday"),
    day: part(date, "day"),
    month: part(date, "month"),
    time: new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
    }).format(start.epochMilliseconds),
    zone: part(at({ hour: "numeric", timeZoneName: "shortGeneric" }), "timeZoneName"),
  };
}

/** Whether the start falls on a different calendar day on the reader's clock than on the place's. */
export function otherDay(startsAt: string, reader: string) {
  const start = Temporal.ZonedDateTime.from(startsAt);
  return !start.toPlainDate().equals(start.withTimeZone(reader).toPlainDate());
}

/**
 * An event's start to its end, on one clock, in `locale`: the dates and times from
 * Intl.DateTimeFormat's formatRange (which says the day once when it's the same, in each language's
 * own way), then the clock's name as `format` writes it. Not formatRange's own name: Chromium's
 * writes the city in English in a range ("6:00–7:30 เวลาSydney", where `format` gives
 * "เวลาออสเตรเลียตะวันออก", Chrome 158, 2026-11-18).
 */
export function formatWhen(
  locale: string,
  start: number,
  end: number,
  { timeZoneName, ...options }: Intl.DateTimeFormatOptions & { timeZone: string },
): string {
  const range = new Intl.DateTimeFormat(locale, options).formatRange(start, end);
  if (!timeZoneName) {
    return range;
  }
  const zone = part(
    new Intl.DateTimeFormat(locale, {
      timeZone: options.timeZone,
      timeZoneName,
      hour: "numeric",
    }).formatToParts(start),
    "timeZoneName",
  );
  return zone ? `${range} ${zone}` : range;
}
