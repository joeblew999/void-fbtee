# plans/void-form-without-javascript.md: booking and posting without JavaScript

Status: found 2026-11-14; the upstream issue below is drafted, not filed (it waits for the user's OK).

## What happens

With JavaScript off, neither form submits: not booking a seat (`pages/[lang]/events/[id].tsx`, `Book`)
and not posting an event (`pages/[lang]/events/new.tsx`).

The server already works without JavaScript. A plain form post to the event's page books the seat
and answers with the page (checked on the dev server 2026-11-14, and `e2e/preview/server.test.ts`,
"a plain form post with the reminder box ticked books the seat").

The browser side is where it fails. The page's HTML has:

```html
<form
  class="grid gap-4"
  aria-busy="false"
  action="javascript:throw new Error('React form unexpectedly submitted.')"
>
```

## Why

- Void's React `Form` (`@void/react` 1.8.0, `dist/index.mjs`, `function Form`) always sets
  `action: form[method]`. That is a function.
- React renders a form whose action is a function as `action="javascript:throw …"` on the server. It
  only gives a real URL when the function carries `$$FORM_ACTION`, as React Server Components'
  server functions do.
- Void's docs say nothing about forms without JavaScript (`guide/pages-routing/actions-and-forms.md`,
  `reference/api/pages.md` "Form", checked 2026-11-14).

So this is Void's `Form`, not this app. Writing a second, hand-made form in the app would duplicate
what `Form` does (errors, retries, pending state). It would also leave a no-JavaScript visitor on a
page that doesn't say they're booked. That's why the fix belongs in Void.

## The issue for voidzero-dev/void (draft)

Title: React `<Form>` can't submit without JavaScript (action renders as `javascript:throw`)

> `Form` from `@void/react` 1.8.0 passes `form.post` (a function) as the form's `action`. React
> renders a function action as `action="javascript:throw new Error('React form unexpectedly
> submitted.')"`, so with JavaScript off (or before hydration) the form can't be sent. The page's
> action itself handles a plain `application/x-www-form-urlencoded` POST fine: it runs and answers
> with the page.
>
> React gives a function action a real URL during server rendering when the function has a
> `$$FORM_ACTION` method returning `{ action, method, encType, data }`. `form.post` could carry one
> pointing at the action's URL (`/users`, `/users/42?update`), so `Form` works before hydration and
> without JavaScript, with JavaScript taking over once loaded. The inputs then need `name`
> attributes, as the docs' example already has.
>
> Seen in https://github.com/joeblew999/void-fbtee: the event page's booking form.

## After it's fixed upstream

Give the form inputs `name` attributes, and add hidden inputs for the values the visitor doesn't
type: the booking's `id` and `time_zone`. Then add a preview test that books with JavaScript off.
