# Translating strings in a Void app

How to fill an fbtee catalog entry is in fbtee's own skill,
`node_modules/fbtee/skills/fbtee-translate/SKILL.md`. This page adds what's specific to apps that
use void-fbtee.

## Where things are

- **Catalogs:** `i18n/translations/<locale>.json`, one per locale except the source locale.
  `void-fbtee prepare` writes them; you edit them. Don't edit anything else under `i18n/`.
- **Locales:** `voidFbtee({ sourceLocale, locales })` in `vite.config.ts`. A locale written as an
  object can set its URL `segment` and its text direction `dir`.
- **Source locale:** the language the code is written in (`sourceLocale`). It has no catalog:
  its text comes from the code.

## A finished entry

Set the text in `translations[0].translation`, keep every `{placeholder}` exactly as written, and
change `"status": "new"` to `"status": "translated"`. Leave `tokens`, `types` and the hash keys as
they are. An entry with variations (plurals, gender) needs every variation filled before it's
finished. Plural forms often come as separate entries (for example "1 night left" and
"{number} nights left"): translate each one.

## fbtee's built-in strings

Every catalog also has 12 strings from fbtee itself (`fbtee/Strings.json`): how lists are joined
("{list of items}, and {last item}") and number labels ("{number}+", "<{number}"). Their
descriptions explain them. Use the locale's own conventions, not word-for-word English. For
lists, match what `Intl.ListFormat` gives for the locale (CLDR's data), for example
`node -e 'console.log(new Intl.ListFormat("ar-EG").format(["A","B","C"]))'` prints `A وB وC`:
no commas, and "و" written onto the next item. Use `{ type: "disjunction" }` for the "or"
lists.

## Right-to-left locales

Locales such as `ar-EG` are right-to-left. void-fbtee sets `<html dir="rtl">` from the locale, so
write natural text with no direction marks (U+200E, U+200F). Keep placeholders as they are; the
browser lays them out.

## Checking

`void-fbtee check` lists anything still `"new"` per locale. While the dev server runs, the
browser console names each string a page shows untranslated.
