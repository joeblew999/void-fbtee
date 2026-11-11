// One event: its title and description in the language the organiser wrote them in (marked with
// lang, so the browser and screen readers use the right one), its start on both clocks, the seats
// left (live: every open page sees a booking), and booking a seat with Void's useForm.
import { useEffect, useState } from "react";
import { fbt } from "fbtee";
import { Form, useForm, useRouter } from "@void/react";
import { connectLiveStream } from "void/live/client";
import { Link, useLocale, useTimeZone } from "void-fbtee/react";
import { EventTime } from "@/components/EventTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Props } from "./[id].server";

/**
 * The event's live stream: the seats left (seats only go down, so the lower count wins), and
 * reloading the page's data when its translations arrive (queues/translate.ts).
 */
function useLiveEvent(id: string, left: number) {
  const router = useRouter();
  const [live, setLive] = useState(Infinity);
  useEffect(() => {
    const stream = connectLiveStream("/api/live");
    void stream.subscribe({
      id: "event",
      topic: `event:${id}`,
      onEvent: (event) => {
        if (event.type === "seats") setLive((event.data as { left: number }).left);
        if (event.type === "translated") void router.refresh();
      },
    });
    return () => stream.close();
  }, [id, router]);
  return Math.min(left, live);
}

/** Booking, in the reader's zone (Event remounts it once the browser knows it). */
function Book({ id, zone, soldOut }: { id: string; zone: string; soldOut: boolean }) {
  const { locale } = useLocale();
  const form = useForm(
    "/[lang]/events/[id]",
    { name: "", email: "", time_zone: zone },
    { params: { lang: locale, id } },
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

export default function Event({ event, text, left }: Props) {
  const { locale } = useLocale();
  // "UTC" until hydration, then the browser's zone; nothing has been typed into the form yet.
  const zone = useTimeZone();
  const seatsLeft = useLiveEvent(event.id, left);
  // In the page's language once translated; until then, as written.
  const shown = text ?? event;
  const lang = text ? locale : event.locale;
  const written = new Intl.DisplayNames(locale, { type: "language" }).of(event.locale);
  return (
    <article className="grid gap-6">
      <Link href={`/${locale}/events`} className="text-muted-foreground text-sm">
        <fbt desc="Link back to the list of events">All events</fbt>
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight" lang={lang} data-testid="event-title">
        {shown.title}
      </h1>
      <EventTime startsAt={event.starts_at} />
      <p className="max-w-prose" lang={lang} data-testid="event-description">
        {shown.description}
      </p>
      {text && (
        <details className="text-muted-foreground text-sm">
          <summary data-testid="event-translated">
            <fbt desc="Note under an event: its text was machine-translated from this language">
              Translated by machine from <fbt:param name="language">{written}</fbt:param>
            </fbt>
          </summary>
          <div className="mt-2 grid gap-1" lang={event.locale} data-testid="event-original">
            <strong>{event.title}</strong>
            <p>{event.description}</p>
          </div>
        </details>
      )}
      {!text && event.locale !== locale && (
        <p className="text-muted-foreground text-sm" data-testid="event-translating">
          <fbt desc="Note under an event: shown as written while it is being translated">
            Written in <fbt:param name="language">{written}</fbt:param>. Translating…
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
    </article>
  );
}
