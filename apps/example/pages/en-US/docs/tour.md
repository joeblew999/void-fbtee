<script>
import EventTime from "../../../src/components/EventTime.tsx" with { island: "load" }
import Fmt from "../../../src/components/Fmt.tsx" with { island: "load" }

// A client script (no island): the reader's own time zone, which only the browser knows. The
// server leaves the space empty rather than showing a stand-in.
for (const el of document.querySelectorAll("[data-your-zone]")) {
  el.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone
}
</script>

---

title: The tour
description: Post an event, book a seat, and see every time on the event's clock and on yours.
updated: "2026-11-12"
---

# Events that know what time it is where you are

[[toc]]

Post an event in your city. Anyone, anywhere, sees when it starts on **your** clock and on
**theirs**, in their own language. No time zone maths, no "is that my 7 pm or yours?". {.lead}

![The Void logo](/void.svg)

## Try it {#try-it}

1. Post an event in your own language.
2. Switch language at the top: the event follows you.
3. Book a seat :tada:

> [!TIP] Your time zone
> This page knows yours from your browser: <span data-your-zone></span>.

## Post it in your language {#post}

Write the title and description the way you'd say them. Readers see it as you wrote it, marked
with the language it's in, so their browser and screen reader read it properly.

::: tip Write it as you'd say it
Use your own words and your own way of writing dates. Readers see your words as you wrote them.
:::

::: warning Pick the event's city
Set the city where the event happens, not the one you're in now. Every time is worked out from
it.
:::

> [!NOTE] The language is saved too
> Each event records the language it was written in, so a reader in another language can see it
> translated, and the original.

## Every time, twice {#times}

Each event shows its start where it happens, again on your own clock, and how far off it is.
Daylight saving is worked out for the date of the event, not for today.[^dst] Here is the night
market in Bangkok, in your language and your time zone:

<EventTime startsAt="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />

<dl>
  <dt>The event's clock</dt>
  <dd>The time where the event happens: what's on the poster.</dd>
  <dt>Your clock</dt>
  <dd>The same moment where you are: when you need to leave home.</dd>
</dl>

> [!IMPORTANT] The event's clock comes first
> The start is the time on the event's own clock. Yours is worked out from it, never the other
> way round.

::: info Why both
<mark>Someone in another city</mark> needs both: the time on the poster, and the time on their
own phone.
:::

## Saved once, shown in every language {#stored}

What you post is saved as plain data, not as text in your language: the start on its city's
clock with the city's time zone, the same moment in UTC, the number of seats. Each event's page
shows it under **Stored as**. Switch language at the top: everything on the page changes, except
that box.

| What            | Saved as                                  | Shown as                  |
| --------------- | ----------------------------------------- | ------------------------- |
| The start       | `2027-03-06T18:30:00+07:00[Asia/Bangkok]` | In your language          |
| The same in UTC | `2027-03-06T11:30:00Z`                    | Not shown; for sorting    |
| Seats           | `40`                                      | In your language's digits |

::: details What an event looks like, saved
```json {4} :line-numbers
{
  "id": "6f1c…",
  "title": "Night market",
  "starts_at": "2027-03-06T18:30:00+07:00[Asia/Bangkok]",
  "starts_at_utc": "2027-03-06T11:30:00Z",
  "seats": 40,
  "locale": "th-TH"
}
```
:::

::: danger Never save formatted text
Text such as "6 Mar, 6:30 pm" is only right in one language and one time zone. Save the data and
format it for each reader:

```ts
const saved = start.toLocaleString("en-US"); // [!code --]
const saved = start.toString(); // [!code ++]
const shown = start.toLocaleString(locale); // [!code focus]
const sorted = start.toLocaleString(); // [!code error]
const guessed = new Date(start.epochMilliseconds); // [!code warning]
```
:::

> [!WARNING] Some phones have no Temporal yet
> Today's iPhones don't have Temporal built in, so the app brings its own there. The times are
> the same.

> [!CAUTION] Moving an event to another city
> Changing an event's time zone changes when it happens for everyone. Change the time with it.

Copy a code block with its button, or select it and press <kbd>Ctrl</kbd> + <kbd>C</kbd>.

## Formatted for you {#formatted}

Each value below is a `<Fmt>` island (`src/components/Fmt.tsx`), so it's formatted for you, in
this page's language:

- A number: <Fmt num="1234567.891" />
- Money: <Fmt money="1299" currency="THB" />
- A time, on its place's clock: <Fmt when="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- The same time, on yours: <Fmt yours="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- How far off it is: <Fmt ago="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />
- Languages, named in yours: <Fmt langs />

Back to [every time, twice](./tour.md#times), or [see the upcoming events](../events).

[^dst]:
    Bangkok has no daylight saving, but a city that does changes its clocks on a date of its
    own: the time shown for a day in July is worked out for July.
