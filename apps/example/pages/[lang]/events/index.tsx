// Upcoming events, each on its own city's clock and the reader's. Posting one is its own page
// (new.tsx).
import { routeUrl } from "void/routes";
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";
import { EventTime } from "@/components/EventTime";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Props } from "./index.server";

export default function Events({ events }: Props) {
  const { locale, lang } = useLocale();
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-medium" data-testid="events-title">
          <fbt desc="Heading of the events page">Upcoming events</fbt>
        </h1>
        <Link
          href={routeUrl("/[lang]/events/new", { params: { lang } })}
          className={buttonVariants()}
          data-testid="post-link"
        >
          <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
        </Link>
      </div>
      <ul className="grid gap-4" data-testid="events-list">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={routeUrl("/[lang]/events/[id]", { params: { lang, id: e.id } })}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <CardTitle lang={e.text ? locale : e.locale} data-testid="event-title">
                    {e.text?.title ?? e.title}
                  </CardTitle>
                  <Badge variant="secondary">
                    <fbt desc="How many seats an event has">
                      <fbt:plural count={e.seats} many="seats" showCount="yes">
                        seat
                      </fbt:plural>
                    </fbt>
                  </Badge>
                </CardHeader>
                <CardContent>
                  <EventTime startsAt={e.starts_at} />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
