<script>
import EventTime from "../../../src/components/EventTime.tsx" with { island: "load" }
import Fmt from "../../../src/components/Fmt.tsx" with { island: "load" }
</script>

---

title: The tour
description: Post an event, book a seat, and see every time on the event's clock and on yours.
---

# Events that know what time it is where you are

Post an event in your city. Anyone, anywhere, sees when it starts on **your** clock and on
**theirs**, in their own language. No time zone maths, no "is that my 7 pm or yours?".

## Post it in your language

Write the title and description the way you'd say them. Readers see it as you wrote it, marked
with the language it's in, so their browser and screen reader read it properly.

## Every time, twice

Each event shows its start where it happens, again on your own clock, and how far off it is.
Daylight saving is worked out for the date of the event, not for today. Here is the night market
in Bangkok, in your language and your time zone:

<EventTime startsAt="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />

## Saved once, shown in every language

What you post is saved as plain data, not as text in your language: the start on its city's
clock with the city's time zone, the same moment in UTC, the number of seats. Each event's page
shows it under **Stored as**. Switch language at the top: everything on the page changes, except
that box.

## Formatted for you

Each value below is a `<Fmt>` island (`src/components/Fmt.tsx`), so it's formatted for you, in
this page's language:

- A number: <Fmt num="1234567.891" />
- Money: <Fmt money="1299" currency="THB" />
- A time, on its place's clock: <Fmt when="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- The same time, on yours: <Fmt yours="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- How far off it is: <Fmt ago="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- Languages, named in yours: <Fmt langs />

[See the upcoming events](../events)
