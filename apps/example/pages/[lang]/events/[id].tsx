// One event: its title and description in the language the organiser wrote them in (marked with
// lang, so the browser and screen readers use the right one), its start on both clocks, the seats
// left (live: every open page sees a booking), and booking a seat with Void's useForm.
import { routeUrl } from "void/routes";
import { Fragment, useEffect, useState } from "react";
import { fbt } from "fbtee";
import { Form, useForm } from "@void/react";
import { connectLiveStream } from "void/live/client";
import { Formatted, Link, useLocale, useTimeZone } from "void-fbtee/react";
import { EventTime } from "@/components/EventTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Props } from "./[id].server";

/** The event's live stream: the seats left (seats only go down, so the lower count wins). */
function useLiveEvent(id: string, left: number) {
  const [live, setLive] = useState(Infinity);
  useEffect(() => {
    const stream = connectLiveStream("/api/live");
    let closed = false;
    stream
      .subscribe({
        id: "event",
        topic: `event:${id}`,
        onEvent: (event) => {
          if (event.type === "seats") setLive((event.data as { left: number }).left);
        },
      })
      // Closed by this effect's cleanup before subscribing finished: not an error.
      .catch((error: unknown) => {
        if (!closed) throw error;
      });
    return () => {
      closed = true;
      stream.close();
    };
  }, [id]);
  return Math.min(left, live);
}

/** Booking, in the reader's zone (Event remounts it once the browser knows it). */
function Book({ id, zone, soldOut }: { id: string; zone: string | null; soldOut: boolean }) {
  const { lang } = useLocale();
  const form = useForm(
    "/[lang]/events/[id]",
    { name: "", email: "", time_zone: zone ?? "" },
    { params: { lang, id } },
  );
  if (form.wasSuccessful)
    return (
      <p className="font-medium" data-testid="booked">
        <fbt desc="Shown after booking a seat on an event">You're booked. See you there!</fbt>
      </p>
    );
  // The 409 from the action: someone else took the last seat (the live count may say so first).
  if (form.error?.status === 409)
    return (
      <p className="text-destructive text-sm" data-testid="sold-out-error">
        <fbt desc="Booking error: the last seat went just before">
          Sorry, the last seat has just gone.
        </fbt>
      </p>
    );
  if (soldOut) return null;
  return (
    <Form form={form} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="book-name">
            <fbt desc="Booking form label: the booker's name">Your name</fbt>
          </Label>
          <Input
            id="book-name"
            data-testid="book-name"
            value={form.data.name}
            onChange={(e) => form.setData("name", e.target.value)}
          />
          {form.errors.name && (
            <p className="text-destructive text-sm" data-testid="error-name">
              <fbt desc="Booking form error: no name">What's your name?</fbt>
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="book-email">
            <fbt desc="Booking form label: the booker's email address">Email</fbt>
          </Label>
          <Input
            id="book-email"
            type="email"
            data-testid="book-email"
            value={form.data.email}
            onChange={(e) => form.setData("email", e.target.value)}
          />
          {form.errors.email && (
            <p className="text-destructive text-sm" data-testid="error-email">
              <fbt desc="Booking form error: not an email address">
                That's not an email address.
              </fbt>
            </p>
          )}
        </div>
      </div>
      <Button type="submit" disabled={form.pending} data-testid="book" className="w-fit">
        <fbt desc="Button: book a seat on the event">Book a seat</fbt>
      </Button>
    </Form>
  );
}

/**
 * The event as it's saved in the database: neutral data, the same in every language. Everything
 * else on the page is formatted from it, in the page's language and the reader's zone.
 */
function Stored({ event }: { event: Props["event"] }) {
  const fields = {
    starts_at: event.starts_at,
    starts_at_utc: event.starts_at_utc,
    seats: event.seats,
    locale: event.locale,
  };
  return (
    <section className="grid gap-2 border-t pt-6 text-sm">
      <h2 className="font-medium">
        <fbt desc="Heading of the box showing an event exactly as it's saved in the database">
          Stored as
        </fbt>
      </h2>
      <p className="text-muted-foreground">
        <fbt desc="Under 'Stored as': what the box shows and why it never changes">
          Exactly as it's saved, whatever language you read it in. Everything above is written from
          it, for your language and your clock.
        </fbt>
      </p>
      <dl
        dir="ltr"
        className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-4 font-mono text-xs"
        data-testid="event-stored"
      >
        {Object.entries(fields).map(([name, value]) => (
          <Fragment key={name}>
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="break-all">{String(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

export default function Event({ event, text, left }: Props) {
  const { locale, lang } = useLocale();
  // The browser's zone once known (null before); nothing has been typed into the form yet.
  const zone = useTimeZone();
  const seatsLeft = useLiveEvent(event.id, left);
  // In the page's language where a translation is stored (the sample events); else as written.
  const shown = text ?? event;
  const textLang = text ? locale : event.locale;
  const written = new Intl.DisplayNames(locale, { type: "language" }).of(event.locale);
  return (
    <article className="grid gap-6">
      <Link
        href={routeUrl("/[lang]/events", { params: { lang } })}
        className="text-muted-foreground text-sm"
      >
        <fbt desc="Link back to the list of events">All events</fbt>
      </Link>
      <h1 className="text-3xl font-medium" lang={textLang} data-testid="event-title">
        {shown.title}
      </h1>
      <EventTime startsAt={event.starts_at} />
      <p className="max-w-prose" lang={textLang} data-testid="event-description">
        {shown.description}
      </p>
      {text && (
        <details className="text-muted-foreground text-sm">
          <summary data-testid="event-translated">
            <fbt desc="Note under an event: its text was machine-translated from this language">
              Translated by machine from{" "}
              <fbt:param name="language">
                <Formatted>{written!}</Formatted>
              </fbt:param>
            </fbt>
          </summary>
          <div className="mt-2 grid gap-1" lang={event.locale} data-testid="event-original">
            <strong>{event.title}</strong>
            <p>{event.description}</p>
          </div>
        </details>
      )}
      {!text && event.locale !== locale && (
        <p className="text-muted-foreground text-sm" data-testid="event-written-in">
          <fbt desc="Note under an event shown as its poster wrote it, in another language">
            Written in{" "}
            <fbt:param name="language">
              <Formatted>{written!}</Formatted>
            </fbt:param>.
          </fbt>
        </p>
      )}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>
            <fbt desc="Heading of the booking box on an event's page">Book a seat</fbt>
          </CardTitle>
          <Badge variant={seatsLeft ? "secondary" : "destructive"} data-testid="seats-left">
            {seatsLeft ? (
              <fbt desc="How many seats an event has left">
                <fbt:plural count={seatsLeft} many="seats left" showCount="yes">
                  seat left
                </fbt:plural>
              </fbt>
            ) : (
              <fbt desc="Badge: an event has no seats left">Sold out</fbt>
            )}
          </Badge>
        </CardHeader>
        <CardContent>
          <Book key={zone} id={event.id} zone={zone} soldOut={seatsLeft === 0} />
        </CardContent>
      </Card>
      <Stored event={event} />
    </article>
  );
}
