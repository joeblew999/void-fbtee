// The package's translation code against test data it didn't make (plans/translation-simple.md):
// test/entries.json (six new catalog entries, written by hand), test/request.json (the request each
// must become, written by hand), test/answers.json (Gemini's real answer to each, recorded with
// `cf ai run` on 2026-11-18). Both ways: entries to requests, answers back onto the right lines.
import { expect, test } from "vite-plus/test";
import entries from "../entries.json" with { type: "json" };
import requests from "../request.json" with { type: "json" };
import answers from "../answers.json" with { type: "json" };
import {
  answerText,
  fieldsAnswer,
  fieldsRequest,
  stringAnswer,
  stringRequest,
  usageOf,
  type Entry,
  type GeminiAnswer,
} from "../../src/gemini";
import { fieldProblems, problemsWith } from "../../src/judge";
import { spent } from "../../src/models";

type CatalogEntry = (typeof entries.translations)[keyof typeof entries.translations];
const keys = Object.keys(entries.translations) as (keyof typeof entries.translations)[];
const FROM = "en-US";
const TO = entries.locale;

/** A catalog entry as the code sends it: its description, and its lines in the source language. */
const entryOf = (e: CatalogEntry): Entry => ({
  description: e.description,
  lines: e.translations.map((l) => ({
    text: l.translation,
    variations: l.variations as Record<string, number>,
  })),
});

const answerOf = (key: string) => (answers.answers as Record<string, GeminiAnswer>)[key]!;
const linesOf = (key: string) => JSON.parse(answerText(answerOf(key)).text);

test("every entry becomes exactly the request written for it by hand", () => {
  expect(keys).toEqual(Object.keys(requests.requests));
  for (const key of keys)
    expect(stringRequest(entryOf(entries.translations[key]), { from: FROM, to: TO }), key).toEqual(
      (requests.requests as Record<string, unknown>)[key],
    );
});

test("each recorded answer goes back onto its entry's own lines, by name", () => {
  for (const key of keys) {
    const entry = entryOf(entries.translations[key]);
    const lines = stringAnswer(entry, linesOf(key));
    expect(lines, key).toHaveLength(entry.lines.length);
    expect(
      lines.every((l) => typeof l === "string" && l.trim()),
      key,
    ).toBe(true);
    // Nothing that would break the app: every line, every placeholder.
    expect(
      problemsWith(
        entry.lines.map((l) => ({ translation: l.text, variations: l.variations })),
        lines,
        TO,
      ),
      key,
    ).toEqual([]);
  }
});

test("a line goes where its name says, whatever order the answer has", () => {
  const entry = entryOf(entries.translations["booked-seats"]);
  const answer = linesOf("booked-seats") as { lines: Record<string, string> };
  const reversed = { lines: Object.fromEntries(Object.entries(answer.lines).reverse()) };
  expect(stringAnswer(entry, reversed)).toEqual(stringAnswer(entry, answer));
  // The woman's lines say "حجزت", the man's "حجز", each on its own line.
  const lines = stringAnswer(entry, answer);
  entry.lines.forEach((l, i) => {
    const gender = l.variations["1"];
    if (gender === 2) expect(lines[i]).toContain("حجزت");
    if (gender === 1) expect(lines[i]).not.toContain("حجزت");
  });
});

test('Arabic\'s "two" may say its number in words; "other" may not drop {number}', () => {
  const entry = entryOf(entries.translations.seats);
  const source = entry.lines.map((l) => ({ translation: l.text, variations: l.variations }));
  const lines = stringAnswer(entry, linesOf("seats"));
  expect(lines[2]).not.toContain("{number}"); // two: "باقي مكانين"
  expect(problemsWith(source, lines, TO)).toEqual([]);
  const dropped = [...lines];
  dropped[5] = "باقي مكان"; // other, with no {number}
  expect(problemsWith(source, dropped, TO)).toEqual([
    "Line 6 must keep the placeholder {number} exactly.",
  ]);
});

test("a line missing, a placeholder lost or made up: caught", () => {
  const entry = entryOf(entries.translations.time);
  const source = entry.lines.map((l) => ({ translation: l.text, variations: l.variations }));
  expect(problemsWith(source, stringAnswer(entry, {}), TO)).toEqual(["Line 1 is missing."]);
  expect(problemsWith(source, ["بتوقيتك"], TO)).toEqual([
    "Line 1 must keep the placeholder {time} exactly.",
  ]);
  expect(problemsWith(source, ["بتوقيتك: {time} {zone}"], TO)).toEqual([
    "Line 1 has {zone}, which the source hasn't: remove it.",
  ]);
  // A name the request didn't have is ignored; a name it had and the answer hasn't is missing.
  const booked = entryOf(entries.translations.booked);
  const got = stringAnswer(booked, {
    lines: { male: "{name} حجز", female: "{name} حجزت", other: "x" },
  });
  expect(got).toEqual(["{name} حجز", "{name} حجزت", undefined]);
});

test("asked again, the request says what came back and what to fix, and nothing else changes", () => {
  const entry = entryOf(entries.translations.time);
  const first = stringRequest(entry, { from: FROM, to: TO });
  const again = stringRequest(entry, {
    from: FROM,
    to: TO,
    retry: {
      answer: { lines: "بتوقيتك" },
      problems: ["Line 1 must keep the placeholder {time} exactly."],
    },
  });
  expect(again.systemInstruction).toEqual(first.systemInstruction);
  expect(again.generationConfig).toEqual(first.generationConfig);
  expect(again.contents[0]!.parts[0]).toEqual(first.contents[0]!.parts[0]);
  expect(again.contents[0]!.parts[1]!.text).toContain("{time}");
});

test("what each answer cost, from its own token counts, thinking paid as output", () => {
  const label = usageOf(answerOf("label"));
  expect(label).toEqual({ in: 265, out: 23, thinking: 102 });
  // US$1.50 a million in, US$7.50 out (models.ts GEMINI).
  expect(spent([label])).toEqual({ in: 265, out: 23, thinking: 102, usd: 0.001335 });
  const all = spent(keys.map((k) => usageOf(answerOf(k))));
  expect(all.usd).toBeCloseTo(0.0247, 3);
  // Asked twice: both paid.
  expect(spent([label, label]).usd).toBe(0.00267);
});

test("a post's fields go by name and come back by name", () => {
  const fields = { title: "เวิร์กช็อปขนมไทยโบราณ", description: "มาเรียนทำขนมไทย" };
  const body = fieldsRequest(fields, { from: "th-TH", to: "en-US" });
  expect(body.systemInstruction.parts[0]!.text).toBe(
    "You translate a post someone wrote in a web app from th-TH into en-US. Each key is one of the post's fields; translate its text.",
  );
  expect(JSON.parse(body.contents[0]!.parts[0]!.text)).toEqual(fields);
  expect(body.generationConfig.responseJsonSchema).toEqual({
    type: "object",
    properties: { title: { type: "string" }, description: { type: "string" } },
    required: ["title", "description"],
  });
  const got = fieldsAnswer(fields, {
    description: "Learn to make Thai desserts",
    title: "Thai Dessert Workshop",
  });
  expect(got).toEqual({
    title: "Thai Dessert Workshop",
    description: "Learn to make Thai desserts",
  });
  expect(fieldProblems(fields, got)).toEqual([]);
  expect(fieldProblems(fields, { title: "Thai Dessert Workshop", description: undefined })).toEqual(
    ['The field "description" is missing.'],
  );
});
