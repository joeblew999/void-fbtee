# plans/same-look-letters.md: the emails, in the site's own look

Status: written 2026-11-13; React Email with the site's CSS straight through, decided with the
user the same day after the probes below. Waiting for the user's approval to build.

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

## How it's normally done, and what the probes showed (2026-11-13)

- **React Email** for the templates: emails written as React components that render to the HTML
  mail apps support (tables, inline styles). Current: `react-email` 6.11.12, `@react-email/components`
  1.0.12 (npm, published 2026-11-12). Cloudflare's Email Sending launch post renders a React Email
  template in a Worker and sends it (blog.cloudflare.com/email-service).
- **Its `<Tailwind>`** turns each `className` into inline styles at render time (most mail apps
  strip `<style>`), with `pixelBasedPreset` for pixel sizes (react.email/docs/components/tailwind).
- **Mail apps don't understand `oklch(…)`, `var()` or `rem`.** The site's colours are all `oklch`.
- **Probe 1, reading `style.css`** (throwaway, in a unit test): Vite's `?raw` gives an empty string
  in Vitest (it leaves CSS out), and the Worker can't read files; read from disk at build time, it
  works. Lightning CSS (already installed, through Tailwind) turned all 33 `.dark` tokens into hex
  (`--background` `#14161c`, `--brand` `#9084ff`, `--border` `rgba(255,255,255,.12)`).
- **Probe 2, three emails to the user's Gmail** (the booking email, made-up data): option A (the
  site's own Tailwind + the `juice` inliner) light and dark, and option B (React Email's
  `<Tailwind>`) light. All three looked right to the user. A needed about 50 lines of our own glue
  (unwrapping Tailwind's `@layer`s, filling `var()`s, `rem` to `px`, logical padding), tied to how
  Tailwind writes its output today. B needed none: no `var(`, `oklch`, `rem` or classes left, the
  plain-text part made from the same template, and Outlook's button fix (`mso-padding-alt`) added
  on its own.
- **B on Cloudflare's runtime** (`workerd` 1.20261110.1, the bundle run directly): 69 ms for the
  first email, then about 10 ms each. It adds about 1.85 MB to the Worker, 0.54 MB compressed
  (today's Worker: 3.76 MB, 0.81 MB compressed; Cloudflare's limit on the paid plan: 10 MB).
- **Probe 3, `oklch` given to React Email as written:** it wrote `rgb(143,129,255)` for
  `oklch(0.68 0.19 285)` and `rgb(255,255,255,0.12)` for the border, no `oklch` left. So no
  conversion step is needed; Lightning CSS (probe 1) isn't used.
- **Probe 4, `style.css?raw` where the emails run:** the real file (8,417 characters) in dev and
  in the Worker build (a throwaway route); in the unit tests only with Vitest's `css` setting
  (`test.css.include`), empty without it. React Email's `<Tailwind>` takes only a `config` object,
  not a stylesheet (its `setup-tailwind.ts` compiles its own `@import`s plus `@config`), so the
  values have to be read from `style.css` and handed over.
- **Probe 5, the existing CSS as it is, then fully straight through** (to the user's Gmail): the
  `.dark` and `:root` palettes unchanged (`:root` is shadcn's untouched default, with no `--brand`);
  then everything from `style.css` (the `@theme inline` colours, radius and font, filled from
  `.dark`), nothing typed by us but React Email's `pixelBasedPreset`. No `oklch`, `var(`, `calc(` or
  classes left; three corner radii stay in `rem` (the site's own values, passed on as given). The
  user: "it looked fine in Gmail, perfectly fine."

## The decisions (with the user, 2026-11-13)

1. **React Email, with the site's CSS straight through.** The last probe, "fully straight
   through", looked perfectly fine in the user's Gmail: the booking email in the site's own dark
   look, every value taken from `apps/example/pages/style.css` as written. No email palette of our
   own, no `.email` block, no conversion step, no Vite plugin, no Lightning CSS: React Email turns
   `oklch` into `rgb(…)` and works out the `calc()`s itself. (The light versions looked right too;
   the site's own look won, as it needs nothing extra.)
2. **The bridge, all of it:** `src/emails/theme.ts` imports `style.css` as text (Vite's built-in
   `?raw`), takes the `@theme inline` entries (`--color-*`, `--radius-*`, `--font-*`), fills their
   `var()`s from the `.dark` block, and hands them to React Email's `<Tailwind>` under the site's
   names, with React Email's own `pixelBasedPreset`. Checked: `?raw` gives the real file in dev and
   in the Worker build; in the unit tests only with Vitest's `css` setting
   (`test.css.include: [/style\.css/]` in `apps/example/vite.config.ts`).
3. **The emails name tokens, never colours:** `bg-background`, `text-brand`, `rounded-lg`, as the
   pages do. A change to `style.css` changes the emails at the next build.
4. **Plain names, one folder:** `src/emails/`: `Layout.tsx` (the site's name, a 600px column, a
   short footer, `lang`/`dir`, `<Preview>`, `<Tailwind>` with the theme), and `BookingEmail.tsx`,
   `LinkEmail.tsx`, `CancelledEmail.tsx`, `ReminderEmail.tsx`, each with its words, the event's
   details, and a `<Button>`.
5. **Each email takes everything as props** and looks nothing up; the actions, `queues/cancel.ts`
   and `crons/reminders.ts` gather the data, as now. No email calls Workers AI: the wording is
   translated ahead of time (`<fbt>`), and the event's title is whatever's stored.
6. **Translated as pages are:** the words in `<fbt>`, rendered inside `inLocale()`, so
   `vp run i18n:translate` and `i18n:check` cover them. The event's title in its own `<bdi>`.
7. **Both parts from one template:** React Email's `render()` and its plain-text output, sent with
   Void's `sendEmail` as now; the four `send…Email` functions and their callers don't change.
   `written()` and the hand-made HTML go.
8. **Seen through Void, nothing extra:** Void's harness in the unit tests, Void's dev inbox (by
   doing the real thing in dev; open to the user over Tailscale), and `vp run test:dev`.

## The work

1. Add `@react-email/components` (current) to the example's dependencies.
2. `src/emails/theme.ts` and Vitest's `css` setting (decision 2), with a unit test: the theme has
   the site's colours, radius and font, under its names, as `style.css` has them.
3. `src/emails/`: the layout and the four emails (decisions 4–6); `src/events/emails.ts` keeps its
   types, `startsAt` and the senders, now rendering the components (decision 7).
4. `vp run i18n:prepare`, `i18n:translate`, `i18n:check`: Thai and Arabic for new or changed
   wording.
5. Unit tests (`src/events/emails.test.ts`, Void's harness, fixed sample data, no AI): the six as
   now, on the rendered emails, plus: inline styles in the site's colours, a button with the link,
   no `oklch`, the text part has the same words.
6. Dev tests (`vp run test:dev`): the same flows as now, plus the same look checks on what Void's
   inbox received.
7. Look at all four in Void's dev inbox in English, Thai and Arabic; the user too, over Tailscale.
8. One real booking email to the user's Gmail from the live site, after a push.
9. The Worker's size and an email's render time after the change, against the numbers above.
10. Docs: the SKILL's note on emails, `DESIGN.md` (the emails' look), the comment at the top of
    `emails.ts`. Remove "the emails' design" from `plans/quiet-harbor-atlas.md`, "Still open".

## Not in this plan

- A logo image (mail apps need PNG at an absolute URL; the site has none yet).
- Moving the emails' layout into the void-fbtee package: only if a second app needs it.

## Verification

`vp check`; `vp run example#test`; `vp run test:dev`; the dev inbox in three languages; one real
email in Gmail. After a push, CI and the live check.
