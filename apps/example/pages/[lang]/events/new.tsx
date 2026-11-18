// Posting an event: Void's useForm and Form, typed from the action in new.server.ts, with the
// event's fields (src/events/EventFields.tsx, shared with changing it) and where to email the
// private link.
import { fbt } from "fbtee";
import { Form } from "@void/react";
import { useForm, useTimeZone } from "void-fbtee/react";
import { EventFields } from "@/events/EventFields";
import { EventsCrumbs } from "@/events/EventsCrumbs";
import { Field } from "@/events/Field";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
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
    local_end: "",
    time_zone: zone ?? "",
    seats: 20,
    email: "",
  });
  return (
    <Form form={form} className="grid max-w-2xl gap-5">
      <EventFields form={form} zones={zones} prefix="event" />
      <Field
        id="event-email"
        name="email"
        label={
          <fbt desc="Form label: an email address to send the poster their private link to (optional)">
            Email me my private link (optional)
          </fbt>
        }
        hint={
          <p id="event-email-why" className="text-sm text-muted-foreground">
            <fbt desc="Under the private link email field: what the link is for, and that the address isn't kept">
              The link lets you change or delete your event later, from any device. Your address is
              only used to send it.
            </fbt>
          </p>
        }
        error={
          form.errors.email && (
            <fbt desc="Form error: the email address isn't one">That isn't an email address.</fbt>
          )
        }
      >
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
      </Field>
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
          <fbt common>Post an event</fbt>
        </EventsCrumbs>
        <h1 className="text-3xl font-medium text-balance md:text-4xl" data-testid="new-event-title">
          <fbt common>Post an event</fbt>
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
