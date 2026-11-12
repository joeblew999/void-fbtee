// Posting an event: Void's useForm and Form, typed from the action in new.server.ts. What it sends
// is neutral (the picker's "2026-04-01T20:00" and a zone name); the event's page shows it back in
// every language and on every clock.
import { routeUrl } from "void/routes";
import { fbt } from "fbtee";
import { Form, useForm } from "@void/react";
import { Link, useLocale, useTimeZone } from "void-fbtee/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Props } from "./new.server";

/**
 * The form, starting in the reader's zone (the page remounts it once the browser knows it), with
 * the server's zones. What it sends is neutral: the picker's "2026-04-01T20:00" and a zone name.
 */
function PostEvent({ zone, zones }: { zone: string | null; zones: string[] }) {
  const { lang } = useLocale();
  const form = useForm(
    "/[lang]/events/new",
    { title: "", description: "", local: "", time_zone: zone ?? "", seats: 20 },
    { params: { lang } },
  );
  const error = (field: keyof typeof form.errors, message: React.ReactNode) =>
    form.errors[field] && (
      <p className="text-destructive text-sm" data-testid={`error-${field}`}>
        {message}
      </p>
    );
  return (
    <Card>
      <CardContent className="pt-6">
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
                {[...new Set([...(zone ? [] : [""]), "UTC", ...zones])].map((z) => (
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

export default function NewEvent({ zones }: Props) {
  const { lang } = useLocale();
  // The browser's zone once known (null before); nothing has been typed into the form yet.
  const zone = useTimeZone();
  return (
    <div className="grid gap-6">
      <Link
        href={routeUrl("/[lang]/events", { params: { lang } })}
        className="text-muted-foreground text-sm"
      >
        <fbt desc="Link back to the list of events">All events</fbt>
      </Link>
      <h1 className="text-3xl font-medium" data-testid="new-event-title">
        <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
      </h1>
      <PostEvent key={zone} zone={zone} zones={zones} />
    </div>
  );
}
