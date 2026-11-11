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
they are.

## Plurals

A string with a count gets one line per plural form the language uses. `void-fbtee prepare` adds
them, because fbtee's own prepare-translations doesn't. Each line's `variations` says which form it
is, by fbtee's code for the CLDR category:

| code | 16   | 4   | 8   | 20  | 12   | 24    |
| ---- | ---- | --- | --- | --- | ---- | ----- |
| form | zero | one | two | few | many | other |

Write each line in the grammar of that form. Polish, for example: few is 2–4, 22–24 ("{number}
noce"), many is 5–21, 25 ("{number} nocy"). The form a count falls in is what
`new Intl.PluralRules(locale).select(n)` gives; fbtee's runtime uses the same rule. A form can
leave out `{number}` where the language does (Arabic two: "ليلتان"). Don't add or remove lines:
`prepare` adds exactly the forms the language needs and marks the entry `"new"` when one is
missing.

A `<fbt:plural>` also comes as a separate entry for exactly 1 (for example "1 night left" next to
"{number} nights left"). Translate both. Its forms leave out any that only 1 can reach, so a
language like German needs no forms for it at all.

Keep one count per string. Two counts in one string need a line for every combination (36 in
Arabic).

## fbtee's built-in strings

Every catalog also has 12 strings from fbtee itself (`fbtee/Strings.json`): how fbtee's `list()`
joins items ("{list of items}, and {last item}") and number labels ("{number}+", "<{number}").
Their descriptions explain them. Use the locale's own conventions, not word-for-word English. For
the list strings, use CLDR's conventions, which `Intl.ListFormat` prints, for example
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
