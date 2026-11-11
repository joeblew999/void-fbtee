// An event's start: on the clock where it happens, on the reader's own clock (when that's a
// different zone), and how far off it is. The place's clock is the server's text, kept through
// hydration (<Formatted>); the reader's clock and "in N days" are the browser's alone, filled in
// once it knows the zone (useTimeZone), with nothing shown before.
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { Formatted, useLocale, useNow, useTimeZone } from "void-fbtee/react";
import { relativeDays } from "@/lib/relative-days";

const WHEN: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "longGeneric",
};

export function EventTime({ startsAt }: { startsAt: string }) {
  const { locale } = useLocale();
  const reader = useTimeZone();
  const now = useNow();
  const start = Temporal.ZonedDateTime.from(startsAt);
  const at = (timeZone: string) =>
    new Intl.DateTimeFormat(locale, { ...WHEN, timeZone }).format(start.epochMilliseconds);
  return (
    <div className="grid gap-1 text-sm">
      <div data-testid="event-local">
        <Formatted>{at(start.timeZoneId)}</Formatted>
      </div>
      {/* The reader's clock and how far off: only the browser knows the zone, so these lines are
          empty (their space kept) until it does, then filled once. None if it's the event's zone. */}
      {reader !== start.timeZoneId && (
        <div className="min-h-5 text-muted-foreground" data-testid="event-yours">
          {reader && (
            <fbt desc="An event's start time on the reader's own clock">
              Your time: <fbt:param name="time">{at(reader)}</fbt:param>
            </fbt>
          )}
        </div>
      )}
      <div className="min-h-5 text-muted-foreground" data-testid="event-when">
        {reader && relativeDays(locale, start.withTimeZone(reader), now)}
      </div>
    </div>
  );
}

// Default export: Markdown pages import it as an island (pages/<locale>/docs/tour.md).
export default EventTime;
