// Upcoming events, each on its own city's clock and the reader's, and a form to post one: Void's
// useForm and Form, typed from the action in index.server.ts.
import { fbt } from "fbtee";
import { Form, useForm } from "@void/react";
import { Link, useLocale, useTimeZone } from "void-fbtee/react";
import { EventTime } from "@/components/EventTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Props } from "./index.server";

const ZONES = Intl.supportedValuesOf("timeZone");

/** The form, starting in the reader's zone (Events remounts it once the browser knows it). */
function PostEvent({ zone }: { zone: string }) {
  const { locale } = useLocale();
  const form = useForm(
    "/[lang]/events",
    { title: "", description: "", local: "", time_zone: zone, seats: 20 },
    { params: { lang: locale } },
  );
  const error = (field: keyof typeof form.errors, message: React.ReactNode) =>
    form.errors[field] && (
      <p className="text-destructive text-sm" data-testid={`error-${field}`}>
        {message}
      </p>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form form={form} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="event-title">
              <fbt desc="Form label: the event's title">Title</fbt>
            </Label>
            <Input
              id="event-title"
              data-testid="event-title-input"
              value={form.data.title}
              onChange={(e) => form.setData("title", e.target.value)}
            />
            {error("title", <fbt desc="Form error: the title is missing">Give it a title.</fbt>)}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-description">
              <fbt desc="Form label: what the event is about">What it's about</fbt>
            </Label>
            <Textarea
              id="event-description"
              data-testid="event-description-input"
              value={form.data.description}
              onChange={(e) => form.setData("description", e.target.value)}
            />
            {error(
              "description",
              <fbt desc="Form error: the description is missing">Say what it's about.</fbt>,
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-local">
                <fbt desc="Form label: when the event starts, on the clock where it happens">
                  Starts, local time
                </fbt>
              </Label>
              <Input
                id="event-local"
                type="datetime-local"
                data-testid="event-local-input"
                value={form.data.local}
                onChange={(e) => form.setData("local", e.target.value)}
              />
              {error("local", <fbt desc="Form error: no start time">When does it start?</fbt>)}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-zone">
                <fbt desc="Form label: the time zone where the event happens">Time zone</fbt>
              </Label>
              <NativeSelect
                id="event-zone"
                data-testid="event-zone-input"
                value={form.data.time_zone}
                onChange={(e) => form.setData("time_zone", e.target.value)}
              >
                {[...new Set(["UTC", ...ZONES])].map((z) => (
                  <NativeSelectOption key={z} value={z}>
                    {z}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-2 sm:max-w-40">
            <Label htmlFor="event-seats">
              <fbt desc="Form label: how many seats the event has">Seats</fbt>
            </Label>
            <Input
              id="event-seats"
              type="number"
              min={1}
              data-testid="event-seats-input"
              value={form.data.seats}
              onChange={(e) => form.setData("seats", e.target.valueAsNumber)}
            />
            {error("seats", <fbt desc="Form error: seats must be 1 or more">At least 1 seat.</fbt>)}
          </div>
          <Button type="submit" disabled={form.pending} data-testid="event-post" className="w-fit">
            <fbt desc="Button: post the new event">Post it</fbt>
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function Events({ events }: Props) {
  const { locale } = useLocale();
  // "UTC" until hydration, then the browser's zone; nothing has been typed into the form yet.
  const zone = useTimeZone();
  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-semibold tracking-tight" data-testid="events-title">
        <fbt desc="Heading of the events page">Upcoming events</fbt>
      </h1>
      <ul className="grid gap-4" data-testid="events-list">
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/${locale}/events/${e.id}`} className="block">
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
      <PostEvent key={zone} zone={zone} />
    </div>
  );
}
