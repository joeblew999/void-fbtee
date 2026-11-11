// An event's start: on the clock where it happens, on the reader's own clock (when that's a
// different zone), and how far off it is. Times in the reader's zone show in UTC until hydration
// (useTimeZone), as the formats page's do.
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { useLocale, useNow, useTimeZone } from "void-fbtee/react";
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
      <div data-testid="event-local">{at(start.timeZoneId)}</div>
      {reader !== start.timeZoneId && (
        <div className="text-muted-foreground" data-testid="event-yours">
          <fbt desc="An event's start time on the reader's own clock">
            Your time: <fbt:param name="time">{at(reader)}</fbt:param>
          </fbt>
        </div>
      )}
      <div className="text-muted-foreground" data-testid="event-when">
        {relativeDays(locale, start.withTimeZone(reader), now)}
      </div>
    </div>
  );
}

// Default export: Markdown pages import it as an island (pages/<locale>/tour/index.md).
export default EventTime;
