# plans/sure-keeper-link.md: a poster never loses their private link

Status: approved 2026-11-13; items 1-6 done 2026-11-13 (checked on dev and by `e2e/events.test.ts`, 9 of 9), item 7 to do.

## Context

The example has no accounts: whoever posts an event gets a private link (`#key=…` after the
event's address, `src/events/delete-key.ts`, `plans/tidy-ember-ledger.md`), and the link is what
lets them delete it. Found 2026-11-13 by the live email check: when the poster books a seat on their
own event, the page comes back without `#key=…` and the Delete box is gone for good (the cookie that
first carried the key has already been cleared).

What drops it: Void 1.8.0's client takes the address to show after an action from the action's URL
(`/en-US/events/<id>?default`), which has no `#` part, so an action that updates the page in place
writes its address without the page's `#…` (`void/dist/pages/client.mjs`, `prepareVisit` and the
commit, around lines 874-878 and 912-915). `router.refresh()` keeps it. Read in Void's code, not yet
reproduced in a plain Void app.

Sites with no accounts handle a private link in two ways (Craigslist emails its "manage your
posting" link; Doodle emails a poll's admin link), and this plan does both: the browser keeps it,
and the poster can have it emailed. Decided with the user 2026-11-13.

## The work, as one change

1. [x] **The browser keeps the key.** On the event page (`pages/[lang]/events/[id].tsx`,
       `YourEvent`): the key is read from the address, else the cookie, else the browser's storage
       for that event (`localStorage`, one entry per event), and saved there once found. When the
       address has lost its `#key=…` (an action, or Void issue #810), the page puts it back.
       Deleting the event removes the entry. Storage that throws or is empty (private mode, blocked)
       changes nothing: the address and cookie work as now.
2. [x] **"Email me my private link" when posting.** An optional email field on the posting form
       (`pages/[lang]/events/new.tsx`). With it, posting sends the poster an email in the page's
       language (`inLocale`): the event's title and its private link, saying it's the way to delete
       the event later. The address is used to send and is not stored. Same sender and code shape
       as the booking email, in one file of the events' emails (`src/events/emails.ts`).
3. [x] **Deleting tells everyone who booked.** Today deleting removes the event with its bookings
       and nobody is told. Now the delete action (`pages/[lang]/events/[id].server.ts`, `remove`)
       reads the bookings' names, emails and languages before deleting, and sends them to a queue
       (`queues/`, as `queues/translate.ts`), which emails each one "this event is cancelled" in
       their own language (`inLocale`, as the booking email), from the same sender. The delete
       answers at once however many booked. The poster gets no email: they just did it.
       And anyone with the event's page open sees it at once: the delete also publishes "deleted"
       on the event's live stream (as booking publishes the seats left), and every open copy, in
       any language, shows "This event has been cancelled" with a link to the events list in place
       of the booking box, with no reload. Added with the user 2026-11-13.
4. [x] **Translations** for the new strings in Thai and Arabic; `vp run i18n:check` all good.
5. [x] **Tests.** - Unit (`vp run example#test`): the link email and the cancellation email, each in two
       languages, through Void's test harness, as the booking email's test does. - e2e (`e2e/events.test.ts`, run on its own): post, book a seat, and the Delete box is still
       there, then delete with it; post with an email and the event's page is as before. - e2e: one browser has the event open, another deletes it, the first shows it's cancelled. - On dev: the link email in Void's inbox; delete an event with a booking, and the
       cancellation is in the inbox in the booker's language.
6. [x] **Docs:** `DESIGN.md` (the form's new field, the Your event box), the comments in
       `delete-key.ts`.
7. [ ] **Void:** reproduce the dropped `#…` in a plain `void init` app. If it reproduces, write the
       issue text for the user to file, as with #809 and #810; if not, find what in this app
       causes it before changing anything else.

## Verification

`vp check`, `vp run example#test`, `vp run i18n:check`, `vp test run --project e2e
e2e/events.test.ts`. On dev (Tailscale): post with an email, book a seat on it, the Delete box
stays; the link email is in the inbox; deleting it puts the cancellation in the inbox. After a push: the same on the live site, the email checked in
the user's Gmail with the Gmail connector, the test event deleted.

## Not in this plan

Accounts or sign-in (`plans/quiet-harbor-atlas.md` step 9). Editing an event.
