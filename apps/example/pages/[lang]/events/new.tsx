// Posting an event: Void's useForm and Form, typed from the action in new.server.ts. What it sends
// is neutral (the picker's "2026-04-01T20:00" and a zone name); the event's page shows it back in
// every language and on every clock.
import { fbt } from "fbtee";
import { Form } from "@void/react";
import { useForm, useTimeZone } from "void-fbtee/react";
import { EventsCrumbs } from "@/events/EventsCrumbs";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect, NativeSelectOption } from "@/ui/native-select";
import { Textarea } from "@/ui/textarea";
import type { Props } from "./new.server";

/**
 * The form, starting in the reader's zone (the page remounts it once the browser knows it), with
 * the server's zones. What it sends is neutral: the picker's "2026-04-01T20:00" and a zone name.
 */
function PostEvent({ zone, zones }: { zone: string | null; zones: string[] }) {
  const form = useForm("/[lang]/events/new", {
    title: "",
    description: "",
    venue: "",
    local: "",
    time_zone: zone ?? "",
    seats: 20,
    email: "",
  });
  const error = (field: keyof typeof form.errors, message: React.ReactNode) =>
    form.errors[field] && (
      <p className="text-destructive text-sm" data-testid={`error-${field}`}>
        {message}
      </p>
    );
  return (
    <Form form={form} className="grid max-w-2xl gap-5">
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
      <div className="grid gap-2">
        <Label htmlFor="event-venue">
          <fbt desc="Form label: where the event happens (optional)">Where (optional)</fbt>
        </Label>
        <Input
          id="event-venue"
          data-testid="event-venue-input"
          value={form.data.venue ?? ""}
          onChange={(e) => form.setData("venue", e.target.value)}
        />
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
      <div className="grid gap-2">
        <Label htmlFor="event-email">
          <fbt desc="Form label: an email address to send the poster their private link to (optional)">
            Email me my private link (optional)
          </fbt>
        </Label>
        <Input
          id="event-email"
          type="email"
          autoComplete="email"
          dir="ltr"
          aria-describedby="event-email-why"
          data-testid="event-email-input"
          value={form.data.email ?? ""}
          onChange={(e) => form.setData("email", e.target.value)}
        />
        <p id="event-email-why" className="text-sm text-muted-foreground">
          <fbt desc="Under the private link email field: what the link is for, and that the address isn't kept">
            The link lets you delete your event later, from any device. Your address is only used to
            send it.
          </fbt>
        </p>
        {error(
          "email",
          <fbt desc="Form error: the email address isn't one">That isn't an email address.</fbt>,
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={form.pending}
        data-testid="event-post"
        className="w-full sm:w-fit"
      >
        <fbt desc="Button: post the new event">Post it</fbt>
      </Button>
    </Form>
  );
}

export default function NewEvent({ zones }: Props) {
  // The browser's zone once known (null before); nothing has been typed into the form yet.
  const zone = useTimeZone();
  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <EventsCrumbs>
          <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
        </EventsCrumbs>
        <h1 className="text-3xl font-medium text-balance md:text-4xl" data-testid="new-event-title">
          <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
        </h1>
        <p className="max-w-xl text-muted-foreground text-pretty">
          <fbt desc="Under the heading of the form for posting an event: what happens to it">
            Write it in your own language and give its start on the local clock. It shows on the
            board in every language, on every reader's clock.
          </fbt>
        </p>
      </div>
      <div className="border-t pt-8">
        <PostEvent key={zone} zone={zone} zones={zones} />
      </div>
    </div>
  );
}
