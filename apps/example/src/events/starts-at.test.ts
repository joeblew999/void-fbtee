// A new event's start and end as they're saved (db/schema/events.ts): the form's local times in
// the event's zone, and the same moments in UTC; and the form schema's checks on the times and the
// zone. Pure Temporal and zod, so it runs under `vp test` in Node (no Worker, no database).
import { expect, test } from "vite-plus/test";
import { changeEventSchema, newEventSchema, when } from "@schema";

const event = { title: "Night market", description: "Street food.", seats: 20 };

test("when keeps the place's clock for the start and the end, and the same moments in UTC", () => {
  expect(when("2027-03-06T18:30", "2027-03-06T21:30", "Asia/Bangkok")).toEqual({
    starts_at: "2027-03-06T18:30:00+07:00[Asia/Bangkok]",
    starts_at_utc: "2027-03-06T11:30:00Z",
    ends_at: "2027-03-06T21:30:00+07:00[Asia/Bangkok]",
    ends_at_utc: "2027-03-06T14:30:00Z",
  });
  // Sydney is on daylight time in March (+11:00).
  expect(when("2027-03-07T06:00", "2027-03-07T07:30", "Australia/Sydney").starts_at_utc).toBe(
    "2027-03-06T19:00:00Z",
  );
});

test("a time that doesn't exist on a clock-change day moves forward, as the clock does", () => {
  // New York's clocks go from 2:00 to 3:00 on 14 March 2027, so there is no 2:30 that night.
  const t = when("2027-03-14T02:30", "2027-03-14T05:00", "America/New_York");
  expect(t.starts_at).toBe("2027-03-14T03:30:00-04:00[America/New_York]");
  expect(t.starts_at_utc).toBe("2027-03-14T07:30:00Z");
});

test("the form takes a real start, end and zone, and refuses anything else", () => {
  const valid = {
    ...event,
    local: "2027-03-06T18:30",
    local_end: "2027-03-06T21:30",
    time_zone: "Asia/Bangkok",
  };
  expect(newEventSchema.safeParse(valid).success).toBe(true);
  expect(newEventSchema.safeParse({ ...valid, time_zone: "Mars/Olympus_Mons" }).success).toBe(
    false,
  );
  expect(newEventSchema.safeParse({ ...valid, local: "next Tuesday" }).success).toBe(false);
  // The end is required, and after the start.
  expect(newEventSchema.safeParse({ ...valid, local_end: undefined }).success).toBe(false);
  const before = newEventSchema.safeParse({ ...valid, local_end: "2027-03-06T18:00" });
  expect(before.success).toBe(false);
  expect(before.error?.issues.map((i) => i.path.join("."))).toEqual(["local_end"]);
  expect(newEventSchema.safeParse({ ...valid, local_end: valid.local }).success).toBe(false);
  // Overnight is fine: the end is the next day.
  expect(newEventSchema.safeParse({ ...valid, local_end: "2027-03-07T01:00" }).success).toBe(true);
});

test("changing takes the same fields, with the poster's key, and no email", () => {
  const change = {
    ...event,
    local: "2027-03-06T18:30",
    local_end: "2027-03-06T21:30",
    time_zone: "Asia/Bangkok",
    key: "k",
  };
  expect(changeEventSchema.safeParse(change).success).toBe(true);
  expect(changeEventSchema.safeParse({ ...change, key: "" }).success).toBe(false);
  expect(changeEventSchema.safeParse({ ...change, local_end: "2027-03-06T10:00" }).success).toBe(
    false,
  );
});
