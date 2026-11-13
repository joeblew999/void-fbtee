# plans/same-look-letters.md: the emails, in the site's own look

Status: written 2026-11-13, waiting for the user's approval.

## Context

The example sends four emails (`apps/example/src/events/emails.ts`): a booking's confirmation, the
poster's private link, a cancellation, and the reminder the day before. They're right underneath
(each in its reader's language and direction, the event's title marked in its own, a plain-text
part, sent with Void's `sendEmail`), but they look bare: `written()` makes a few `<p>`s and a raw
link, with no heading, layout, button or colour. Parked by the user on 2026-11-13, picked up the
same day.

What the user asked for: the emails look like the site, the styling isn't spread around, and it's
done the proper way, with what Void already gives.

## What's already there (checked 2026-11-13)

- **Void's dev inbox** (`guide/email/sending.md`, "Local development"): in dev every send lands in
  `/__void/inbox` (the dev server prints the address with its token); a message opens to preview
  its HTML, or downloads as `.eml`; it keeps the last 100 through hot reload.
- **Void's test harness**, `createEmailTestHarness` from `void/email/testing`: the unit tests
  (`src/events/emails.test.ts`, six tests) already build and send each email through it.
- **The dev tests**, `vp run test:dev`, already set off every email through the app and read it
  back from Void's inbox (`emailTo()` in `e2e/helpers.ts`, raw message through `postal-mime`):
  the private link (post with an email), the booking in Thai (book a seat), the cancellations in
  English and Arabic (delete an event with bookings; the `cancel` queue), and the reminders in
  Thai and Arabic (the daily cron through `/__void/scheduled`). They check subjects, words and
  links, not looks.
- **No AI in the way:** none of the four emails calls Workers AI. AI only translates an event's
  title in the background; an email prints whichever title is stored. Workers AI runs in dev, the
  preview and live; not in the unit tests, which don't need it.

## How it's normally done (checked 2026-11-13)

- **React Email** for the templates: emails written as React components that render to the HTML
  mail apps support (tables, inline styles). Current: `react-email` 6.11.12 and
  `@react-email/components` 1.0.12, published 2026-11-12 (npm). Cloudflare's Email Sending launch
  post renders a React Email template in a Worker and sends it (blog.cloudflare.com/email-service).
- **Tailwind class names, inlined when rendered:** React Email's `<Tailwind>` turns each
  `className` into inline styles at render time; most mail apps strip `<style>`. It uses Tailwind
  4.1.12, and `pixelBasedPreset` because some mail apps don't support `rem`
  (react.email/docs/components/tailwind).
- **Mail apps don't understand `oklch(…)`**, so email setups for Tailwind 4 use hex
  (`@maizzle/tailwindcss`'s notes); no flexbox, grid or media queries.

## The decisions (Claude's, with the reasons)

1. **One source of style: `apps/example/pages/style.css`.** The emails use the site's token names
   (`bg-background`, `text-foreground`, `rounded-lg`), so a colour changed there changes the emails.
2. **No copy of the style to keep in step.** One module, `src/emails/theme.ts`, reads the tokens
   from `style.css`, converts the dark palette's `oklch` colours to hex, and gives `<Tailwind>` its
   config under the same names, with the radius, the system font and `pixelBasedPreset`. How it
   reads `style.css` (Vite's `?raw`, or at build) is settled by what works in both the Worker and
   the unit tests, checked first.
3. **Plain names, one folder:** `src/emails/`: `Layout.tsx` (the site's name, a 600px column, the
   content, a short footer, `lang`/`dir`, `<Preview>`), and `BookingEmail.tsx`, `LinkEmail.tsx`,
   `CancelledEmail.tsx`, `ReminderEmail.tsx`, each filling the layout with its words, the event's
   details, and a `<Button>` in place of the raw link.
4. **Each email takes everything as props** (the reader's language, name, the event's title and its
   language, the start, the link) and looks nothing up. The actions, `queues/cancel.ts` and
   `crons/reminders.ts` gather the data, as now.
5. **Translated as pages are:** the words in `<fbt>`, rendered inside `inLocale()` as now, so
   `vp run i18n:translate` and `i18n:check` cover them. The event's title in its own
   `<bdi lang dir>`.
6. **Both parts from one template:** React Email's `render()` for the HTML and its plain-text
   output for the text part. Sent with Void's `sendEmail` as now: the four `send…Email` functions
   and their callers don't change. `written()` and the hand-made HTML go.
7. **Seen through Void, nothing extra:** no preview tool, route or task of our own. While building,
   the emails are seen in Void's dev inbox by doing the real thing in dev (post, book, delete, the
   reminder through `/__void/scheduled`), open to the user over Tailscale too.
8. **Dark, checked in Gmail first:** the site's dark palette, unless Gmail's handling makes it
   unreadable, then a light version from the site's `:root` tokens (same names, same module).

## The work

1. Add React Email to the example's dependencies (current versions, the packages its docs give for
   `<Tailwind>` with Tailwind 4).
2. `src/emails/theme.ts` (decision 2), with a unit test: the tokens come out as hex, under the
   site's names.
3. `src/emails/`: the layout and the four emails (decisions 3–5); `src/events/emails.ts` keeps
   its types, `startsAt` and the senders, now rendering the components (decision 6).
4. `vp run i18n:prepare`, `i18n:translate`, `i18n:check`: Thai and Arabic for new or changed
   wording.
5. Unit tests (`src/events/emails.test.ts`, Void's harness, fixed sample data, no AI): the six as
   now, on the rendered emails, plus: inline styles in the site's colours, a button with the link,
   no `oklch`, the text part has the same words.
6. Dev tests (`vp run test:dev`): the same flows as now, plus the same look checks on what Void's
   inbox received.
7. Look at all four in Void's dev inbox in English, Thai and Arabic; the user too, over Tailscale.
8. One real booking email to the user's Gmail from the live site, after a push (decision 8).
9. Docs: the SKILL's note on emails, `DESIGN.md` (the emails' look), the comment at the top of
   `emails.ts`. Remove "the emails' design" from `plans/quiet-harbor-atlas.md`, "Still open".

## Not in this plan

- A logo image (mail apps need PNG at an absolute URL; the site has none yet).
- Moving the emails' layout into the void-fbtee package: only if a second app needs it.

## Verification

`vp check`; `vp run example#test`; `vp run test:dev`; the dev inbox in three languages; one real
email in Gmail. After a push, CI and the live check.
