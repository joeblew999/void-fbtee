---
name: void-fbtee-translate
description: How to translate a void-fbtee app's text — its strings (fbtee catalog entries), what people post, its markdown pages — into another language. The same rules for any AI that translates: Void's AI (vp dev and the app's own translate()) is sent this text, and Claude Code reads it when it translates.
---

# Translating a void-fbtee app

Translate so a person who speaks the language would write it that way. Every rule below applies to
any AI translating: void-fbtee sends this text with every request to Void's AI, and a coding agent
reads it as a skill. What to edit and which commands to run is in the void-fbtee skill, not here.

## The app's strings

Each string is a catalog entry: its source lines, a description, the code around it, and the
app's own words for the terms it uses (its glossary). Strings come many at a time: translate each
on its own, by its own description.

- The description says what's happening, to whom, what each placeholder holds and where the text
  shows. Choose the words by it: "book a seat at an event" is not reserving a table or hiring a
  person. It's there to explain: never put its words in the translation.
- Say everything the source says, the same way: a statement stays a statement, a question a
  question, an instruction an instruction, in the same tense. Add nothing and leave nothing out:
  no "successfully" after "booked", no "with this email" after "attached", no "the same" before a
  name said twice, and nothing said twice ("joint en pièce jointe").
- Keep every `{placeholder}` exactly as written, untranslated, and put it where the language
  needs it. Keep what each one means: in "{translated} of {total}", {translated} is the part and
  {total} the whole.
- A placeholder may be a finished value the app writes in the reader's language: a date or time,
  an amount of money with its currency, a number with its unit, a list. Keep it as it is and add
  no unit, currency or word for it: "{price}", never "{price} euros".
- Words marked to keep (commands, file names, paths, product names such as Void's AI or Claude
  Code) stay exactly as written, in Latin letters, never translated or explained. Everything else
  is translated, technical words too: a "coding agent" is an AI program that writes code, said
  the way developers in the language say it, not left in English and not a sales agent.
- Capital letters only where the language puts them: a word in the middle of a sentence is
  lowercase even when the app uses it as a heading elsewhere ("Catalog", "Strings").
- Where the app gives its own word for a term (its glossary, or its other translations when you
  can read them), always use it: the same word for the same thing everywhere, and the same style.
- Give exactly one translated line for each source line, in order.

## Counts: one line per plural form

A line marked with a plural form (zero, one, two, few, many, other) is the sentence for counts in
that form of the language: write it in that form's grammar. The form a count falls in is the
language's own rule (`Intl.PluralRules`). The zero, one and two forms may say the number in words
instead of `{number}` (Arabic two: "مقعدان"). A count also comes as its own entry for exactly 1
("1 seat left" beside "{number} seats left"): translate both.

- Each line is for its own form only. The one line is for 1 (and in French and Hindi 0 too):
  its noun is singular ("{seats} Platz", "{seats} place", "{seats} सीट", "{number} место"), never
  the plural the other lines use.
- Russian: one "место", few (2–4, 22–24…) "места", many (5–20, 25–30…) "мест", other (fractions,
  1,5) "места".
- The zero line says none: a sentence with "not" ("didn't book any seat", Arabic "لم يحجز {who}
  أي مقعد"), never "booked any seats".

## People: one line per gender

A line marked with a gender (male, female, unknown) is the sentence for a person of that gender:
the name's, a pronoun's, or the reader's own. Word it for that gender where the language changes
its words (Arabic's verbs, Hindi's, French and Spanish participles). For unknown, use the
language's usual form for a person whose gender isn't said.

- Each line for its own gender only: the male line in the male form and the female line in the
  female form. A form that covers both (Russian "забронировал(а)") belongs on the unknown line only.
- "Their" for a person whose gender isn't said is that person's own: the language's word for
  one's own (German "das eigene", Chinese "自己的", Vietnamese "của mình"), never a word for other
  people's ("他们的", "của họ") or for one gender ("his", "her", German "ihr").
- The same politeness on every line: Japanese keeps さん after the name on all of them.

## fbtee's built-in strings

How lists are joined and number labels ("{number}+"). Use the language's own conventions, as
`Intl.ListFormat` prints them. fbtee joins every item but the last with one string, the same for
"and", "or" and plain lists, so that string holds the language's comma (Arabic "،").

## What people post

An event's title and description, say: translate it naturally, the way a local would write it.
Keep the names of people and places.

## Markdown pages

Translate the whole page, keeping its structure: the same headings in the same order.

- **Translate:** headings, paragraphs, lists, link text, image alt text, and frontmatter values
  meant for people (`title`, `description`). Keep the keys, and values that are data (dates,
  numbers, slugs, file names).
- **Keep exactly:** the `<script>` block at the top (first in the file; its import paths stay the
  same), components and islands with their props, code blocks, inline code, URLs, HTML
  attributes, and the page's structure (same headings in the same order). That includes links to
  the site's own pages: they're written relative (`../events`, or `./other.md` for a markdown
  page, which @void/md turns into its route), so the copy's links stay in its language as they
  are. In an original, write them that way, never with the language (`/en-US/events`).
- **Boxes and alerts** (`::: tip …`, `> [!NOTE] …`): translate the title after the marker, and
  keep the marker (`tip`, `[!NOTE]`) as it is. The original gives every one a title (@void/md's
  own default titles are English: "TIP", "WARNING", "Details"); `vp dev` and `vp build` report one
  without, in the original or a copy.
- **Also keep exactly:** heading ids (`{#times}`, so `#times` links work in every copy) and other
  `{…}` attributes, footnote labels (`[^dst]`; translate the footnote's text), the keys in
  `<kbd>`, and code blocks with their meta (`{4} :line-numbers`) and `// [!code …]` comments.

## Languages

- Thai: no full stop at the end of a sentence, and no comma after a name; spaces between phrases
  where Thai puts them. Loanwords in Thai letters are fine (แอป, แค็ตตาล็อก).
- Arabic: Modern Standard Arabic, not a dialect, for every Arabic locale, ar-EG (Egypt) included:
  never Egyptian or other spoken Arabic (no مش, لسه, كمان, عشان, no بيـ before a verb). Arabic punctuation (، ؟). No direction marks
  (U+200E, U+200F): the page sets right to left itself. A number followed by a noun takes the
  noun's form for that number: zero says none (لم يتبقَّ أي مقعد, not "0 seats"); two, the dual,
  without the number (مقعدان as a subject, مقعدين as an object); 3 to 10, plural (مقاعد); 11 to 99,
  singular, accusative (مقعدًا); 100 and up, singular (مقعد).
- Right-to-left languages in general: natural text, no direction marks.
- Korean: after a placeholder, give both forms of the particle, as the app does: 을(를), 이(가),
  은(는), since the word it stands for may end in a consonant or a vowel.
