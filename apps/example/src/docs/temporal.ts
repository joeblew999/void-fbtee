// Every row of the Temporal page (pages/[lang]/docs/temporal.tsx): date and time arithmetic with
// Temporal, each result a neutral value (an ISO string, a number), never text for the screen.
// Each row takes the Temporal to run with, so the page runs it four ways: on the Worker (the
// loader) with Cloudflare's own Temporal (what the app runs there: void-fbtee's Vite plugin) and
// with temporal-polyfill, and in the browser after hydration with its own Temporal (if it has
// one) and with the polyfill (what today's iPhones run). Neutral results don't depend on locale
// data, so all four must be identical; where one differs, it names the implementation with the
// bug. Formatting is on the Intl page.
import { Temporal as Polyfill } from "temporal-polyfill/implementation";

/** A Temporal: the polyfill's or the platform's own (globalThis.Temporal), the same API. */
export type TemporalApi = typeof Polyfill;
export { Polyfill };

/** The browser's own Temporal, if it has one. */
export const ownTemporal = () =>
  (globalThis as { Temporal?: TemporalApi }).Temporal as TemporalApi | undefined;

export type TemporalSectionId = "instants" | "zones" | "clock-changes" | "calendar" | "durations";

export interface TemporalRow {
  id: string;
  /** The call, as code. */
  code: string;
  run: (Temporal: TemporalApi) => unknown;
}

const row = (id: string, code: string, run: TemporalRow["run"]): TemporalRow => ({ id, code, run });

const BANGKOK = "2026-12-24T19:30[Asia/Bangkok]";

export const TEMPORAL_SECTIONS: { id: TemporalSectionId; rows: TemporalRow[] }[] = [
  {
    id: "instants",
    rows: [
      row(
        "epoch",
        `Temporal.Instant.from("2026-12-24T12:30:00Z").epochMilliseconds`,
        (Temporal) => Temporal.Instant.from("2026-12-24T12:30:00Z").epochMilliseconds,
      ),
      row(
        "from-epoch",
        `Temporal.Instant.fromEpochMilliseconds(1798115400000).toString()`,
        (Temporal) => Temporal.Instant.fromEpochMilliseconds(1798115400000).toString(),
      ),
      row(
        "to-utc",
        `Temporal.ZonedDateTime.from("${BANGKOK}").toInstant().toString()`,
        (Temporal) => Temporal.ZonedDateTime.from(BANGKOK).toInstant().toString(),
      ),
    ],
  },
  {
    id: "zones",
    rows: [
      row("bangkok", `Temporal.ZonedDateTime.from("${BANGKOK}").toString()`, (Temporal) =>
        Temporal.ZonedDateTime.from(BANGKOK).toString(),
      ),
      ...["Africa/Cairo", "America/Los_Angeles"].map((zone) =>
        row(
          `in-${zone}`,
          `Temporal.ZonedDateTime.from("${BANGKOK}").withTimeZone("${zone}").toString()`,
          (Temporal) => Temporal.ZonedDateTime.from(BANGKOK).withTimeZone(zone).toString(),
        ),
      ),
      ...["Asia/Kolkata", "Asia/Kathmandu"].map((zone) =>
        row(
          `offset-${zone}`,
          `Temporal.ZonedDateTime.from("2026-07-04T12:00[${zone}]").offset`,
          (Temporal) => Temporal.ZonedDateTime.from(`2026-07-04T12:00[${zone}]`).offset,
        ),
      ),
      ...["Asia/Bangkok", "America/Los_Angeles"].map((zone) =>
        row(
          `today-${zone}`,
          `Temporal.Instant.from("2026-12-24T20:00:00Z").toZonedDateTimeISO("${zone}").toPlainDate().toString()`,
          (Temporal) =>
            Temporal.Instant.from("2026-12-24T20:00:00Z")
              .toZonedDateTimeISO(zone)
              .toPlainDate()
              .toString(),
        ),
      ),
    ],
  },
  {
    id: "clock-changes",
    rows: [
      row(
        "add-day",
        `Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]").add({ days: 1 }).toString()`,
        (Temporal) =>
          Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]")
            .add({ days: 1 })
            .toString(),
      ),
      row(
        "add-24-hours",
        `Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]").add({ hours: 24 }).toString()`,
        (Temporal) =>
          Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]")
            .add({ hours: 24 })
            .toString(),
      ),
      row(
        "hours-in-day",
        `Temporal.ZonedDateTime.from("2026-03-29T12:00[Europe/London]").hoursInDay`,
        (Temporal) => Temporal.ZonedDateTime.from("2026-03-29T12:00[Europe/London]").hoursInDay,
      ),
      row(
        "next-change",
        `Temporal.ZonedDateTime.from("2026-01-01T00:00[Europe/London]").getTimeZoneTransition("next")?.toString()`,
        (Temporal) =>
          Temporal.ZonedDateTime.from("2026-01-01T00:00[Europe/London]")
            .getTimeZoneTransition("next")
            ?.toString(),
      ),
      row(
        "missing-hour",
        `Temporal.ZonedDateTime.from("2026-03-29T01:30[Europe/London]").toString()`,
        (Temporal) => Temporal.ZonedDateTime.from("2026-03-29T01:30[Europe/London]").toString(),
      ),
    ],
  },
  {
    id: "calendar",
    rows: [
      row(
        "month-end",
        `Temporal.PlainDate.from("2026-01-31").add({ months: 1 }).toString()`,
        (Temporal) => Temporal.PlainDate.from("2026-01-31").add({ months: 1 }).toString(),
      ),
      row(
        "leap-day",
        `Temporal.PlainDate.from("2028-02-29").add({ years: 1 }).toString()`,
        (Temporal) => Temporal.PlainDate.from("2028-02-29").add({ years: 1 }).toString(),
      ),
      ...(["dayOfWeek", "dayOfYear", "weekOfYear", "daysInMonth", "inLeapYear"] as const).map(
        (field) =>
          row(field, `Temporal.PlainDate.from("2026-07-04").${field}`, (Temporal) =>
            String(Temporal.PlainDate.from("2026-07-04")[field]),
          ),
      ),
      row(
        "round",
        `Temporal.PlainTime.from("15:37:52").round({ smallestUnit: "minute", roundingIncrement: 15 }).toString()`,
        (Temporal) =>
          Temporal.PlainTime.from("15:37:52")
            .round({ smallestUnit: "minute", roundingIncrement: 15 })
            .toString(),
      ),
      row("compare", `Temporal.PlainDate.compare("2026-07-04", "2026-12-24")`, (Temporal) =>
        Temporal.PlainDate.compare("2026-07-04", "2026-12-24"),
      ),
      row(
        "same-moment",
        `Temporal.ZonedDateTime.from("${BANGKOK}").toInstant().equals(Temporal.Instant.from("2026-12-24T12:30:00Z"))`,
        (Temporal) =>
          Temporal.ZonedDateTime.from(BANGKOK)
            .toInstant()
            .equals(Temporal.Instant.from("2026-12-24T12:30:00Z")),
      ),
    ],
  },
  {
    id: "durations",
    rows: [
      row(
        "until",
        `Temporal.PlainDate.from("2026-07-04").until("2026-12-24", { largestUnit: "months" }).toString()`,
        (Temporal) =>
          Temporal.PlainDate.from("2026-07-04")
            .until("2026-12-24", { largestUnit: "months" })
            .toString(),
      ),
      row(
        "days-until",
        `Temporal.PlainDate.from("2026-07-04").until("2026-12-24").days`,
        (Temporal) => Temporal.PlainDate.from("2026-07-04").until("2026-12-24").days,
      ),
      row(
        "balance",
        `Temporal.Duration.from({ hours: 90 }).round({ largestUnit: "days" }).toString()`,
        (Temporal) =>
          Temporal.Duration.from({ hours: 90 }).round({ largestUnit: "days" }).toString(),
      ),
      row("total", `Temporal.Duration.from("PT1H30M").total("minutes")`, (Temporal) =>
        Temporal.Duration.from("PT1H30M").total("minutes"),
      ),
    ],
  },
];

/** Every row's result as text with one Temporal, keyed "<section>/<row>" (an error as its name and message). */
export function runTemporal(Temporal: TemporalApi): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of TEMPORAL_SECTIONS)
    for (const r of section.rows) {
      const key = `${section.id}/${r.id}`;
      try {
        out[key] = String(r.run(Temporal));
      } catch (error) {
        out[key] = `${(error as Error).name}: ${(error as Error).message}`;
      }
    }
  return out;
}
