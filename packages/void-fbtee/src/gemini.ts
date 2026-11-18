// What void-fbtee sends Gemini and how it reads the answer, as plain functions: no Void, no files,
// no network, so the dev server (ai.ts, for the app's strings and pages), the post queue (ai.ts,
// for what people post) and the tests all use the same ones. One string, one post or one page a
// request; the two locale codes and one sentence say what to do; the answer's shape is set with
// responseJsonSchema; each answer is read back by name, never by position
// (plans/translation-simple.md). test/request.json is what these must build, written by hand.
import { MARKS } from "./plurals";
import type { Usage } from "./models";

/** One line of a catalog entry: its text, and the plural form or gender it's for (fbtee's codes). */
export interface Line {
  text: string;
  variations: Record<string, number>;
}

/** A catalog entry to translate: where it shows, and its lines in the source language. */
export interface Entry {
  description: string;
  lines: Line[];
}

/** A request in Gemini's own shape (generateContent), as Void's AI passes it on. */
export interface GeminiRequest {
  systemInstruction: { parts: { text: string }[] };
  contents: { role: "user"; parts: { text: string }[] }[];
  generationConfig: {
    thinkingConfig: { thinkingLevel: "low" };
    responseMimeType?: "application/json";
    responseJsonSchema?: object;
  };
}

/** Gemini's answer (generateContent), the parts void-fbtee reads. */
export interface GeminiAnswer {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

// Hydrogen's lowest thinking: it takes low, medium, high and xhigh; "minimal" and thinkingBudget
// are refused with a 400 (tried 2026-11-18). No temperature: Hydrogen ignores it.
const config = (schema?: object): GeminiRequest["generationConfig"] => ({
  thinkingConfig: { thinkingLevel: "low" },
  ...(schema ? { responseMimeType: "application/json", responseJsonSchema: schema } : {}),
});

const request = (system: string, user: string[], schema?: object): GeminiRequest => ({
  systemInstruction: { parts: [{ text: system }] },
  contents: [{ role: "user", parts: user.map((text) => ({ text })) }],
  generationConfig: config(schema),
});

/**
 * A line's name, by the plural form or gender it's for (MARKS: "few", "female"), a count and a
 * gender together by both, in fbtee's token order ("few, female"). Empty for a line with neither.
 */
export const lineName = (variations: Record<string, number>) =>
  Object.values(variations)
    .map((v) => MARKS[v] ?? `variation ${v}`)
    .join(", ");

/** Whether an entry is one line with no form or gender: sent and answered as plain text. */
const plain = (entry: Entry) =>
  entry.lines.length === 1 && !Object.keys(entry.lines[0]!.variations).length;

const STRING = { type: "string" };

/** Said once more when an answer had problems: what came back and what to fix. */
const again = (retry?: { answer: unknown; problems: string[] }) =>
  retry
    ? [
        `Your last answer was ${JSON.stringify(retry.answer)}. Fix these and change nothing else:\n- ${retry.problems.join("\n- ")}`,
      ]
    : [];

/** The request that translates one of the app's strings (a catalog entry) from `from` into `to`. */
export function stringRequest(
  entry: Entry,
  {
    from,
    to,
    retry,
  }: { from: string; to: string; retry?: { answer: unknown; problems: string[] } },
): GeminiRequest {
  const names = entry.lines.map((l) => lineName(l.variations));
  const lines = plain(entry)
    ? entry.lines[0]!.text
    : Object.fromEntries(entry.lines.map((l, i) => [names[i], l.text]));
  const schema = plain(entry)
    ? STRING
    : {
        type: "object",
        properties: Object.fromEntries(names.map((n) => [n, STRING])),
        required: names,
      };
  return request(
    `You translate a web app's interface text from ${from} into ${to}. You get a description of where the text appears and its lines: one text, or one for each plural form or gender, named for it. Reply with its lines translated, under the same names.`,
    [JSON.stringify({ description: entry.description, lines }), ...again(retry)],
    { type: "object", properties: { lines: schema }, required: ["lines"] },
  );
}

/**
 * An answer to stringRequest, read back: each of the entry's lines, in its order, by its name.
 * A line not answered is undefined.
 */
export function stringAnswer(entry: Entry, answer: unknown): (string | undefined)[] {
  const lines = (answer as { lines?: unknown } | undefined)?.lines;
  if (plain(entry)) return [typeof lines === "string" ? lines : undefined];
  const named = (lines && typeof lines === "object" ? lines : {}) as Record<string, unknown>;
  return entry.lines.map((l) => {
    const line = named[lineName(l.variations)];
    return typeof line === "string" ? line : undefined;
  });
}

/** The request that translates a post's fields (an event's title and description, say). */
export function fieldsRequest(
  fields: Record<string, string>,
  {
    from,
    to,
    retry,
  }: { from: string; to: string; retry?: { answer: unknown; problems: string[] } },
): GeminiRequest {
  const keys = Object.keys(fields);
  return request(
    `You translate a post someone wrote in a web app from ${from} into ${to}. Each key is one of the post's fields; translate its text.`,
    [JSON.stringify(fields), ...again(retry)],
    {
      type: "object",
      properties: Object.fromEntries(keys.map((k) => [k, STRING])),
      required: keys,
    },
  );
}

/** An answer to fieldsRequest, read back by field name. A field not answered is undefined. */
export function fieldsAnswer(
  fields: Record<string, string>,
  answer: unknown,
): Record<string, string | undefined> {
  const got = (answer && typeof answer === "object" ? answer : {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(fields).map((k) => [
      k,
      typeof got[k] === "string" ? (got[k] as string) : undefined,
    ]),
  );
}

/**
 * The request that translates a markdown page whole. Its answer is the page, as text, not JSON.
 * "(their comments too)": without it, a comment inside a code block came back translated
 * (2026-11-18).
 */
export function pageRequest(text: string, { from, to }: { from: string; to: string }) {
  return request(
    `You translate a Markdown page from ${from} into ${to}. Translate the text and the frontmatter's title and description; keep the Markdown structure, code blocks (their comments too), links, components and frontmatter keys as they are. Reply with the page only.`,
    [text],
  );
}

/** The text of an answer, and whether Gemini finished it. */
export function answerText(answer: GeminiAnswer): { text: string; complete: boolean } {
  const candidate = answer.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return {
    text,
    complete: !!text && (!candidate?.finishReason || candidate.finishReason === "STOP"),
  };
}

/** The tokens an answer says its request used: in, out, and thinking. */
export function usageOf(answer: GeminiAnswer): Usage {
  const m = answer.usageMetadata ?? {};
  return {
    in: m.promptTokenCount ?? 0,
    out: m.candidatesTokenCount ?? 0,
    thinking: m.thoughtsTokenCount ?? 0,
  };
}
