// When an event is, from its start to its end: on the clock where it happens, on the reader's own
// clock (when that's a different zone), and how far off its start is. The place's clock is the server's text, kept through
// hydration (<Formatted>); the reader's clock and "in N days" are the browser's alone, filled in
// once it knows the zone (useTimeZone), with nothing shown before.
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { Formatted, useLocale, useNow, useTimeZone } from "void-fbtee/react";
import { relativeDays } from "@/events/relative-days";
import { cn } from "@/ui/utils";

const WHEN: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "longGeneric",
};

export function EventTime({
  startsAt,
  endsAt,
  className,
}: {
  startsAt: string;
  /** Its end, on the same clock: shown as a range (Intl.DateTimeFormat's formatRange). */
  endsAt?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const reader = useTimeZone();
  // Once a minute, so "tomorrow" becomes "today" on a page left open past midnight.
  const now = useNow({ updateInterval: 60_000 });
  const start = Temporal.ZonedDateTime.from(startsAt);
  const end = endsAt ? Temporal.ZonedDateTime.from(endsAt) : undefined;
  const at = (timeZone: string) => {
    const format = new Intl.DateTimeFormat(locale, { ...WHEN, timeZone });
    return end
      ? format.formatRange(start.epochMilliseconds, end.epochMilliseconds)
      : format.format(start.epochMilliseconds);
  };
  return (
    <div className={cn("grid gap-1 text-sm", className)}>
      <div className="text-foreground" data-testid="event-local">
        <Formatted>{at(start.timeZoneId)}</Formatted>
      </div>
      {/* The reader's clock and how far off: only the browser knows the zone, so these lines are
          empty (their space kept) until it does, then filled once. None if it's the event's zone. */}
      {reader !== start.timeZoneId && (
        <div className="min-h-5 text-muted-foreground" data-testid="event-yours">
          {reader && (
            <fbt desc="When an event is, on the reader's own clock; {time} is its start, or its start to its end, already formatted">
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
