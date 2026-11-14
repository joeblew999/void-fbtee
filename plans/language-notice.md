# plans/language-notice.md: offer a visitor their own language on a page in another

Status: split out of `plans/their-own-language.md` on 2026-11-14, when that plan was cut down to
`"/"`. Not in the order yet: the user decides whether it's wanted (`plans/README.md`, "Not in the
order"). The text below is as it was in that plan, with the review's findings on it.

## Why

`plans/their-own-language.md` sends `"/"` to the visitor's language. But someone who follows a
shared link to `/en-US/events/…`, or whose browser kept the old permanent redirect from `"/"` to
`/en-US`, lands on a page in a language that isn't theirs, and only the header's links help them.
And Safari sends only its top language to the server, so a Safari user whose first language the
site doesn't have gets the fallback at `"/"`, where `navigator.languages` in the page knows their
second.

## The notice

**A language page reached from outside offers the person's own language.** Two conditions:

- the page is in a language other than the person's best match from `navigator.languages`;
- they arrived from outside the site: `document.referrer` is empty (a typed address, an email,
  an app, or a browser still holding the old cached 301, which lands on `/en-US` with no
  referrer) or another site's (a search result, a shared link).

When both hold, a small link to the same page in their language shows at the top. It's named by
`Intl.DisplayNames` in that language, from the language subtag only, as `SiteHeader.tsx:84–86`
already does: `of("th")` is "ไทย", where `of("th-TH")` is "ไทย (ไทย)" (Node, 2026-11-14). The link
carries `lang`, `dir` and `hreflang`. It needs no translated sentence and no other language's
catalog on the page. It's added in the browser after load, so the cached page is the same for
everyone.

**How it runs on every page.** Not as a React component in the root layout: on markdown pages and
island pages Void renders layouts "static only, so they are not hydrated on the client"
(`node_modules/void/docs/guide/pages-routing/islands.md`, "Layouts", read 2026-11-14). Instead,
void-fbtee's middleware adds a small script to every page's head (Void's head `script`, "set in
middleware to apply defaults to every page", `head.md`), keeping any head script an earlier
middleware set.

- **Its code:** a small module in the package (`src/notice.ts`) with the same `negotiate()` the
  middleware uses, built by the package's own build into one script and inlined as text with the
  app's languages as data. Not `negotiate.toString()`, which breaks once the function is bundled.
- **Where it goes:** inserted before `#app`, outside it. Void hydrates `#app`
  (`@void/react/dist/runtime/pages-client.mjs`), so anything put inside breaks hydration.
- **It goes on the first move inside the site.** Void's head scripts "are SSR-only. They are not
  re-applied on client-side navigation" (`head.md:133`), so a notice shown on one page would stay
  after Void moves to the next, still linking to the first page. The script removes it at the
  first move. How it sees the move (a Void event, the Navigation API, or `popstate` and link
  clicks) is to be seen first ("To check first"). A plain link that reloads makes a new document
  whose referrer is this site, so it isn't shown again.

There's nothing to dismiss and nothing to remember. How it looks is the app's, through one CSS
class.

It stays a script with the language's name only, now that void-fbtee has `<InLanguage>`
(fbtee-fully): `<InLanguage>` renders on the server, but whether to show the notice is only known
in the browser after load (`navigator.languages`, `document.referrer`), and a sentence in the
visitor's language would mean every page carrying every language's catalog.

## To check first, on Void 1.8.0

- How the notice can see Void's move to the next page: an event of Void's, the Navigation API, or
  `popstate` and link clicks.

## How we'll know it's right

In real Chromium and WebKit (`e2e/browsers/`), on a code page, an island page and a markdown page
(`/en-US/docs/intl`, `/en-US/docs`, `/en-US/docs/tour`):

- a Thai browser opening one from outside sees the link, named "ไทย", with `lang`, `dir` and
  `hreflang`, outside `#app`, and the page hydrates with no errors;
- then a move inside the site by Void: it's gone, and isn't back;
- then a plain link that reloads: it doesn't show;
- an English browser on an English page never sees it;
- it sets no cookie and touches no browser storage.
