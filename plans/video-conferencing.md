# plans/video-conferencing.md: events streamed live, with captions in each watcher's language

Status: proposed 2026-11-14, waiting for the user's OK. This is issue #8 ("video conferencing"),
moved here whole; the issue is closed. It builds on `plans/use-cases.md`: a person who
`taking_part: online` is that plan's "watching online" use case.

## What the issue asks

- Whoever posts an event can tick **"Streamed: watch online"**. Everyone who books then knows they
  can attend from anywhere, and the organiser streams it from the event's page.
- The web pages, the emails and the PDF ticket all show it: the link to watch, and when that is on
  the reader's clock.
- A unified calendar: each booking's calendar entry carries the link (the `.ics` from
  `plans/use-cases.md`).
- **Live captions in each watcher's language.** The app already knows every person's language (their
  locale), as it does for everything else. Speech-to-text first: the speaker's words become text,
  and the text is translated for each watcher. Speaking it in the speaker's voice can come later.
- Getting there for people in person (Google Maps, a flight search) is in `plans/use-cases.md`.

## The tools, checked 2026-11-14

Sources, read 2026-11-14:

- WebTransport in Safari 26.4: https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/
- Cloudflare's MoQ relay: https://blog.cloudflare.com/moq/ and https://developers.cloudflare.com/moq/ (its pages last updated 2026-07-31; demo streams 2026-09-30)
- moq-dev's browser packages: https://doc.moq.dev/lib/js/ and https://depscope.dev/pkg/npm/@moq/publish
- Nova-3 on Workers AI: https://developers.cloudflare.com/workers-ai/models/nova-3/ and https://developers.cloudflare.com/ai-gateway/usage/websockets-api/realtime-api/

- **Browsers:** every major browser now has WebTransport. As of March 2026,
  Safari 26.4 ships WebTransport out of the box. No flags, no workarounds. Chrome, Firefox, and
  Edge already had it.
- **The relay:** Cloudflare's MoQ relay network.
  - Cloudflare is launching the first Media over QUIC (MoQ) relay network,
    running on every Cloudflare server in datacenters in 330+ cities.
  - Its docs say it's in beta and free to use during the beta period (Last
    updated Jul 31, 2026).
  - A relay is made via API: POST to /client/v4/accounts/$ACCOUNT_ID/moq/relays
    with a JSON name and a bearer API token.
  - A new relay returns two default tokens: one for publish and subscribe,
    and one for subscribe only.
  - The docs recommend no browser client libraries, and a Workers binding
    is not mentioned.
- **In the browser:** moq-dev's packages. They include a JavaScript API and
  a `<moq-watch>` Web Component for watching, and the same for publishing (`@moq/publish`).
  - Their own docs warn that MoQ is under active development. The APIs and
    protocols are still evolving and will change.
  - `@moq/publish` was at v0.4.3 (depscope.dev, last updated
    2026-08-03).
- **Speech-to-text:** Deepgram's Nova-3 on Workers AI.
  - Workers AI supports two Deepgram STT models: @cf/deepgram/nova-3 and
    @cf/deepgram/flux, streamed over a WebSocket.
  - Nova-3 is listed as Cloudflare-hosted, Batch, Partner, Real-time.
- **Translation:** the same Workers AI model the app already translates posts with
  (`queues/translate.ts`, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`).

## The first thing to prove

Before any package code, prove the pieces work together:

- Can moq-dev's browser packages talk to Cloudflare's relay? moq-dev's packages use their own
  protocol, moq-lite. Cloudflare's relay speaks the IETF drafts:
  Draft-14 and draft-16 are supported.
- Do they work in Safari 26.4 as well as Chrome? Some of moq-dev's pages still say Chromium only.

The proof is a page in `.vitest/` that publishes the camera from one browser and watches it in
another, through a relay made on the account. Its result decides the plan:

- **If they work together:** Cloudflare's relay.
- **If they don't:** moq-dev's own relay (`moq-relay`, open source), or Cloudflare's own sample
  clients.

## Where it lives: a package, `void-moq`

Its name: `void-moq`, MoQ for Void, as `void-fbtee` is fbtee for Void. Not "void-live": Void has
its own live feature, `void/live` (`defineLiveStream`, `guide/live.md`), which the example already
uses for seat counts (`src/events/live.ts`), and a package with that name would read as Void's own,
or as a wrapper around it.

Video doesn't belong in an app's own code: every app that wants it would write the same relay
setup, tokens, players and caption pipeline. So it's a package beside void-fbtee in this repo,
`packages/void-moq`, and the example uses it as any app would (dog-fooding it, as it does
void-fbtee).

It's a separate package, not part of void-fbtee:

- void-fbtee stays about language;
- an app can have one without the other.

The captions are where the two meet, through void-fbtee's primitives (`plans/primitives.md`).

What it depends on, and what it doesn't. Each layer leans only on the one below it:

1. **Void:** routes, plugin, queues, Workers AI and Durable Objects. That's all `void-moq` requires.
2. **`void-fbtee`:** a real dependency, for its primitives (`plans/primitives.md`): the watcher's
   language and direction, `translate` for the captions, and `momentFor` for "live now" on each
   watcher's clock.
3. **The app:** the events, bookings, who may publish and watch, the emails, ticket and calendar,
   and the use cases. `void-moq` knows none of these. The app ties them together through
   `publishToken()`, `watchToken()` and the components.

So a stream in `void-moq` has no event, time or booking: it's a stream with a name, a publisher,
watchers and caption languages. The per-person times (`viewFor` in `plans/use-cases.md`) start in
the app. If other apps need them too, they move into `void-fbtee` (they're about time and language),
never into `void-moq`.

It's shaped like void-fbtee, so it feels the same to use:

- **`void-moq/plugin`:** `voidMoq()` in `vite.config.ts`, which sets up the relay (Cloudflare's
  MoQ relay, made once with the deploy's token) and the routes that hand out short-lived tokens.
- **`void-moq/server`:** `publishToken()` and `watchToken()`. The app decides who may do which,
  because only it knows its own rules (here: the event's key to publish, a booking to watch).
- **`void-moq/react`:** `<Broadcast>` and `<Watch>` around moq-dev's web components, with captions
  in the watcher's language and the right direction.
- **Captions:** the speech-to-text and translation pipeline, inside the package. The app only
  says which languages to make captions in.
- **`void-moq init`** and a skill (`skills/void-moq/SKILL.md`), like void-fbtee's: an app adds it
  with one command, and an agent can read how to use it.
- Its own unit tests in the package, and a fresh-app test like void-fbtee's (`e2e/fresh/`), so it's
  checked the way a developer receives it.

## What the example then does with it

1. **The event is streamed.**
   - `events.streamed` (boolean), ticked when posting.
   - Each booking's `taking_part` is `there` or `online`.
2. **Who may publish and watch,** through `publishToken()` and `watchToken()`:
   - the organiser publishes with the event's private key;
   - a booker watches with their booking.
3. **The pages.**
   - The event page gets `<Broadcast>` for the organiser and `<Watch>` for people who booked online.
   - Both show when it's on on the reader's own clock, and live status comes through the page's
     existing live updates (`src/events/live.ts`).
4. **The emails, the ticket and the calendar.**
   - "Watch online", with the link and the time on the reader's clock, in their language.
   - The reminder (per person, `plans/use-cases.md`) carries the link.
5. **Docs:** a "Streaming" page (`pages/[lang]/docs/streaming.tsx` on `DocsPage`), linked from the
   home page like every feature, plus the "watching online" use cases in `plans/use-cases.md`.

## Later

- The translated captions spoken aloud, in the speaker's own voice.
- Recording, so people in other time zones can watch afterwards.

## How it's checked

- `vp check`.
- `test:unit`: tokens and caption timing.
- `test:dev`: publish and watch between two Playwright browsers, with captions arriving in Thai and
  Arabic. These run against the real relay and the real Workers AI, not stand-ins.
- `test:preview`: the pages and emails.
- `i18n:check`.

Committed locally, and pushed when the user says.
