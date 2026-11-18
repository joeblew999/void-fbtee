// An event's fields, as its organiser fills them in: posting it (pages/[lang]/events/new.tsx) and
// changing it (the event's page, pages/[lang]/events/[id].tsx). One component, so the two forms
// can't differ. What they send is neutral: the picker's "2026-04-01T20:00" for the start and the
// end, and a zone name; the event's page shows it back in every language and on every clock.
import { fbt } from "fbtee";
import { Field } from "@/events/Field";
import { Input } from "@/ui/input";
import { NativeSelect, NativeSelectOption } from "@/ui/native-select";
import { Textarea } from "@/ui/textarea";

/** The fields both forms have (db/schema/events.ts eventFields). */
export type EventFieldValues = {
  title: string;
  description: string;
  venue?: string | null;
  local: string;
  local_end: string;
  time_zone: string;
  seats: number;
};

/** What of Void's useForm the fields use. */
type EventForm = {
  data: EventFieldValues;
  errors: Partial<Record<keyof EventFieldValues, unknown>>;
  setData<K extends keyof EventFieldValues>(key: K, value: EventFieldValues[K]): void;
};

/**
 * The fields, with the zones to offer (the event's own first when changing it). `prefix` keeps each
 * form's ids and test ids its own ("event" posting, "change" changing).
 */
export function EventFields({
  form,
  zones,
  prefix,
}: {
  form: EventForm;
  zones: string[];
  prefix: string;
}) {
  const id = (name: string) => `${prefix}-${name}`;
  return (
    <>
      <Field
        id={id("title")}
        name="title"
        label={<fbt desc="Form label: the event's title">Title</fbt>}
        error={
          !!form.errors.title && <fbt desc="Form error: the title is missing">Give it a title.</fbt>
        }
      >
        <Input
          id={id("title")}
          data-testid={id("title-input")}
          value={form.data.title}
          onChange={(e) => form.setData("title", e.target.value)}
        />
      </Field>
      <Field
        id={id("description")}
        name="description"
        label={<fbt desc="Form label: what the event is about">What it's about</fbt>}
        error={
          !!form.errors.description && (
            <fbt desc="Form error: the description is missing">Say what it's about.</fbt>
          )
        }
      >
        <Textarea
          id={id("description")}
          data-testid={id("description-input")}
          value={form.data.description}
          onChange={(e) => form.setData("description", e.target.value)}
        />
      </Field>
      <Field
        id={id("venue")}
        name="venue"
        label={<fbt desc="Form label: where the event happens (optional)">Where (optional)</fbt>}
      >
        <Input
          id={id("venue")}
          data-testid={id("venue-input")}
          value={form.data.venue ?? ""}
          onChange={(e) => form.setData("venue", e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={id("local")}
          name="local"
          label={
            <fbt desc="Form label: when the event starts, on the clock where it happens">
              Starts, local time
            </fbt>
          }
          error={
            !!form.errors.local && <fbt desc="Form error: no start time">When does it start?</fbt>
          }
        >
          <Input
            id={id("local")}
            type="datetime-local"
            data-testid={id("local-input")}
            value={form.data.local}
            onChange={(e) => form.setData("local", e.target.value)}
          />
        </Field>
        <Field
          id={id("local-end")}
          name="local_end"
          label={
            <fbt desc="Form label: when the event ends, on the clock where it happens">
              Ends, local time
            </fbt>
          }
          error={
            !!form.errors.local_end && (
              <fbt desc="Form error: no end time, or an end that isn't after the start">
                When does it end? After it starts.
              </fbt>
            )
          }
        >
          <Input
            id={id("local-end")}
            type="datetime-local"
            data-testid={id("local-end-input")}
            value={form.data.local_end}
            onChange={(e) => form.setData("local_end", e.target.value)}
          />
        </Field>
      </div>
      <Field
        id={id("zone")}
        name="time_zone"
        className="sm:max-w-sm"
        label={<fbt desc="Form label: the time zone where the event happens">Time zone</fbt>}
      >
        <NativeSelect
          id={id("zone")}
          data-testid={id("zone-input")}
          value={form.data.time_zone}
          onChange={(e) => form.setData("time_zone", e.target.value)}
        >
          {[...new Set([...(form.data.time_zone ? [] : [""]), "UTC", ...zones])].map((z) => (
            <NativeSelectOption key={z} value={z}>
              {z}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field
        id={id("seats")}
        name="seats"
        className="sm:max-w-40"
        label={<fbt common>Seats</fbt>}
        error={
          !!form.errors.seats && (
            <fbt desc="Form error: seats must be 1 or more">At least 1 seat.</fbt>
          )
        }
      >
        <Input
          id={id("seats")}
          type="number"
          min={1}
          data-testid={id("seats-input")}
          value={form.data.seats}
          onChange={(e) => form.setData("seats", e.target.valueAsNumber)}
        />
      </Field>
    </>
  );
}
