// One event: its title and description in the language the organiser wrote them in (marked with
// lang, so the browser and screen readers use the right one), and its start on both clocks.
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";
import { EventTime } from "@/components/EventTime";
import { Badge } from "@/components/ui/badge";
import type { Props } from "./[id].server";

export default function Event({ event }: Props) {
  const { locale } = useLocale();
  const written = new Intl.DisplayNames(locale, { type: "language" }).of(event.locale);
  return (
    <article className="grid gap-6">
      <Link href={`/${locale}/events`} className="text-muted-foreground text-sm">
        <fbt desc="Link back to the list of events">All events</fbt>
      </Link>
      <h1
        className="text-3xl font-semibold tracking-tight"
        lang={event.locale}
        data-testid="event-title"
      >
        {event.title}
      </h1>
      <EventTime startsAt={event.starts_at} />
      <Badge variant="secondary" className="w-fit" data-testid="event-seats">
        <fbt desc="How many seats an event has">
          <fbt:plural count={event.seats} many="seats" showCount="yes">
            seat
          </fbt:plural>
        </fbt>
      </Badge>
      <p className="max-w-prose" lang={event.locale} data-testid="event-description">
        {event.description}
      </p>
      {event.locale !== locale && (
        <p className="text-muted-foreground text-sm" data-testid="event-written-in">
          <fbt desc="Note under an event: the language its organiser wrote it in">
            Written in <fbt:param name="language">{written}</fbt:param>
          </fbt>
        </p>
      )}
    </article>
  );
}
