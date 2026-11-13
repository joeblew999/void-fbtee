// A new event's start as it's saved (db/schema/events.ts): the form's local time in the event's
// zone, and the same moment in UTC; and the form schema's checks on the time and the zone. Pure
// Temporal and zod, so it runs under `vp test` in Node (no Worker, no database).
import { expect, test } from "vite-plus/test";
import { newEventSchema, startsAt } from "@schema";

const event = { title: "Night market", description: "Street food.", seats: 20 };

test("startsAt keeps the place's clock and the same moment in UTC", () => {
  expect(startsAt("2027-03-06T18:30", "Asia/Bangkok")).toEqual({
    starts_at: "2027-03-06T18:30:00+07:00[Asia/Bangkok]",
    starts_at_utc: "2027-03-06T11:30:00Z",
  });
  // Sydney is on daylight time in March (+11:00).
  expect(startsAt("2027-03-07T06:00", "Australia/Sydney").starts_at_utc).toBe(
    "2027-03-06T19:00:00Z",
  );
});

test("a time that doesn't exist on a clock-change day moves forward, as the clock does", () => {
  // New York's clocks go from 2:00 to 3:00 on 14 March 2027, so there is no 2:30 that night.
  expect(startsAt("2027-03-14T02:30", "America/New_York")).toEqual({
    starts_at: "2027-03-14T03:30:00-04:00[America/New_York]",
    starts_at_utc: "2027-03-14T07:30:00Z",
  });
});

test("the form takes a real local time and zone, and refuses anything else", () => {
  const valid = { ...event, local: "2027-03-06T18:30", time_zone: "Asia/Bangkok" };
  expect(newEventSchema.safeParse(valid).success).toBe(true);
  expect(newEventSchema.safeParse({ ...valid, time_zone: "Mars/Olympus_Mons" }).success).toBe(
    false,
  );
  expect(newEventSchema.safeParse({ ...valid, local: "next Tuesday" }).success).toBe(false);
});
