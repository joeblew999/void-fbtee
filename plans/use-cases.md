# plans/use-cases.md: use cases, written as data, shown in every language

Status: proposed 2026-11-14, waiting for the user's OK. Comes from issues #7 (use cases) and #8
(video conferencing).

## The idea

Every use case has the same shape: **one event, many people.**

- The event is stored once, in neutral form: where it is, its clock, its start and length, and
  whether it's streamed.
- Each person has a language, a place and a way of taking part: there in person, travelling to it,
  watching online, or organising it.
- What each person needs follows from those: when it is on their clock and on their calendar,
  what day it is for them ("tomorrow", "Tuesday night"), when to land or leave, when their reminder
  arrives, their email, ticket and calendar entry in their own language, and the captions they read.

So a use case doesn't need new code each time. It is one data entry (an event and its people), and
the app works out and shows each person's view, in the page's language. Adding a use case means
adding an entry. That's what lets them grow past the first two issues.

## What gets built

1. **The model:** `src/use-cases/`.
   - `types.ts`:
     - `Scenario`: an id, the event, its people;
     - `Person`: name, locale, home zone, how they take part (`there`, `travelling`, `online`,
       `organising`) and, for travel, where they come from.
   - `view.ts`: `viewFor(event, person, now)`, which returns that person's moments as neutral values.
     It uses Temporal only, the same way the events app already does. The moments:
     - starts, and ends;
     - on their clock, and the day it is for them;
     - "arrive by" in the event's own zone;
     - join from home;
     - reminder sent;
     - booking closes.
   - `scenarios.ts`: the use cases, one entry each (the list below).
   - Unit tests for each moment, including the hard ones: daylight saving starting between booking and
     the event, crossing the date line, the Thai Buddhist year, Arabic digits.
2. **Showing them:** a "Use cases" docs page (`pages/[lang]/docs/use-cases.tsx` on `DocsPage`).
   - One section per scenario, with a table: one row per person, and what they see, in this page's
     language.
   - A home page card linking to it, like every feature.
   - Each scenario also has its own address (`/[lang]/docs/use-cases#<id>`) to link to from issues.
3. **The events app does them for real:** the same `viewFor` behind the event page, the emails, the
   ticket and the reminder cron, so the demo and the docs can't drift apart:
   - an event gets an optional end time (length);
   - "Streamed: watch online" when posting (#8, the stream itself comes later);
   - a calendar file (`.ics`, with the event's zone) on the event page and attached to the booking
     email;
   - "Getting there": a Google Maps link to the venue and a flight search arriving the day before,
     plain links with no keys.
4. **New use cases come in as issues:** a GitHub issue form, `.github/ISSUE_TEMPLATE/use-case.yml`,
   that asks for exactly the data fields above (the event, and each person's language, place and way
   of taking part). Each accepted one becomes an entry in `scenarios.ts`.

## The first use cases (the tip)

1. A talk in London at 1 pm, watched live from Bangkok, Cairo and New York: same moment, four clocks,
   three languages, one of them right to left.
2. Flying to it: someone in Sydney must land in London the day before. Their departure date is
   their own, and the date line moves it.
3. Daylight saving in between: booked in March for an April event in London. The offset changes and
   the reader's hour moves; the event's doesn't.
4. A weekly class across the clock change: the same local time each week, a different hour for
   someone abroad.
5. "Tomorrow" isn't the same day for everyone: an evening event in Los Angeles is the next morning in
   Bangkok, so the reminder "the day before" is per person.
6. Booking closes Friday 17:00 London: each person sees their own deadline.
7. Organiser in Bangkok, venue in Cairo, guests from three countries: the organiser's view is the
   venue's clock, not their own.
8. A Thai reader sees the Buddhist year; an Arabic reader, Arabic digits and right-to-left; the
   event's title stays in the language it was written in.
9. Watching online with live captions in your own language (#8): the speaker's language is known and
   the watcher's locale picks the captions. This one is shown in the table now, and works once the
   stream is built.
10. Finding a time that suits everyone: the hours when every guest is awake, shown on each clock.

## Not in this plan

The live stream and captions themselves (#8: MoQ on Cloudflare, speech-to-text and translation on
Workers AI). They get their own plan once this model exists, because the stream's page, emails and
captions all hang off `viewFor`. Cloudflare's MoQ relay launched as a technical preview (moq.dev,
2025-08-22); I'll check its status again before that plan.

## How it's checked

- `vp check`.
- `test:unit`: every moment of every scenario.
- `test:preview`: the Use cases page in all three languages; the .ics file; the new fields.
- `i18n:check`.

Committed locally, and pushed when the user says.
