// Translating with Void's AI (`ai` from `void/ai`), in the app's Worker. One translator for
// everything: what people post, at runtime (an app's queue calls translate()), and the app's own
// strings and pages while `vp dev` runs (the dev server's route calls translateStrings() and
// translatePage(): plugin.ts, devTranslate below). Each is told how to translate by the translating
// skill (skills/void-fbtee-translate/SKILL.md, bundled into the code: TRANSLATING), the text a
// coding agent reads too: instructions() below, the one place a request is worded.
//
// Void's AI is there wherever Void runs the app's code: dev, the preview and Cloudflare, in a
// route, a queue or a job (found 2026-11-13, plans/quiet-harbor-atlas.md, 7b). Void only connects
// it when the app's own files import `void/ai` (Void 1.8.0's binding inference reads the app's
// files, not its packages), so importing this module from void-fbtee changes nothing for an app
// without AI: ai.run then throws "Not available", and the dev server translates another way.
//
// The model, and why: models.ts.
import { ai } from "void/ai";
import skill from "../skills/void-fbtee-translate/SKILL.md?raw";
import { GEMINI, paymentProblem, paymentAdvice, type Usage } from "./models";
import { MARKS } from "./plurals";

export { GEMINI, paymentProblem, paymentAdvice, type Usage };

/**
 * How to translate: the translating skill (skills/void-fbtee-translate/SKILL.md), the same text a
 * coding agent reads, bundled into the code so it travels with it. Its frontmatter is the
 * skill's own label, not a rule.
 */
export const TRANSLATING = skill.replace(/^---\n[\s\S]*?\n---\n+/, "").trim();

/** A language's English name, for the prompt ("Thai" for "th-TH"). */
const named = (locale: string) =>
  new Intl.DisplayNames("en", { type: "language" }).of(locale) ?? locale;

/** Gemini's own answer shape (generateContent). */
interface GeminiAnswer {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

/**
 * Ask Gemini for JSON of a given shape, in its own request shape, as wuchale sends it
 * (src/ai/gemini.ts): the instructions as systemInstruction, thinking off (thinkingBudget 0), JSON
 * asked for by mime type, and the schema in the instructions (asked only for "JSON", Gemini made up
 * its own shape, 2026-11-17). Cloudflare's catalog shows Gemini taking this shape through the
 * binding (its model page's examples, checked 2026-11-17). In the Chat Completions shape its
 * thinking stayed on and spent all 8192 tokens with no answer (2026-11-17).
 */
async function ask<T>(
  system: string,
  user: string,
  schema: object,
  onUsage?: (usage: Usage) => void,
): Promise<T> {
  const result = (await ai.run(
    GEMINI.id as never,
    {
      systemInstruction: {
        parts: [
          {
            text: `${system}\n\nReply with one JSON object and nothing else, matching this JSON Schema: ${JSON.stringify(schema)}`,
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        // A translation, not a story: the model's most likely answer.
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    } as never,
    // Through the account's AI Gateway ("default", Cloudflare's own, made on a first request),
    // which a third-party model needs, and which logs every request; its cache off: a string is
    // asked for once, and its accepted answer is kept in the catalog (AI Gateway docs, "Workers
    // Bindings"; Void's runtime/ai.mjs makeDirectBackend passes this argument on).
    { gateway: { id: "default", skipCache: true } } as never,
  )) as GeminiAnswer;
  const m = result.usageMetadata;
  // Thinking is paid as output: counted with it, so the cost is right even if it isn't off.
  if (onUsage && m)
    onUsage({
      prompt_tokens: m.promptTokenCount ?? 0,
      completion_tokens: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0),
    });
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text || (candidate?.finishReason && candidate.finishReason !== "STOP"))
    throw new Error(
      `${GEMINI.id} gave no complete answer (${candidate?.finishReason ?? "no content"})`,
    );
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as T;
  } catch (error) {
    // Say what came back, so a shape we don't read yet can be seen and fixed.
    throw new Error(
      `${GEMINI.id}'s answer isn't one JSON object: ${String(error)}; it begins ${JSON.stringify(text.slice(0, 200))} and ends ${JSON.stringify(text.slice(-200))}`,
    );
  }
}

/**
 * Translate a few fields of text people wrote (an event's title and description, say) from one
 * language into another. `about` says what they are ("listings for events"). The same keys come
 * back.
 */
export async function translate<K extends string>(
  fields: Record<K, string>,
  { from, to, about }: { from: string; to: string; about: string },
): Promise<Record<K, string>> {
  const keys = Object.keys(fields) as K[];
  const out = await ask<Record<K, string>>(
    instructions(
      "post",
      about,
      { from, to },
      "Reply with JSON only: an object with the same keys.",
    ),
    // The language to write in, said again with the text, as the strings' request says it: given
    // only in the system prompt, a model has answered with the text unchanged (a Thai post left in
    // English, AI Gateway's logs, 2026-11-16).
    `Translate from ${named(from)} into ${named(to)}:\n${JSON.stringify(fields)}`,
    {
      type: "object",
      properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])),
      required: keys,
    },
  );
  return Object.fromEntries(keys.map((k) => [k, String(out[k] ?? "")])) as Record<K, string>;
}

/** What's translated: the app's `<fbt>` text, what people post, a markdown page. */
export type Kind = "fbt" | "post" | "page";

/** The skill's sections each kind is sent (its `## ` headings). */
const SECTIONS: Record<Kind, string[]> = {
  fbt: [
    "The app's strings",
    "Counts: one line per plural form",
    "People: one line per gender",
    "fbtee's built-in strings",
    "Languages",
  ],
  post: ["What people post", "Languages"],
  page: ["Markdown pages", "Languages"],
};

const bySection = new Map(
  TRANSLATING.split(/^## /m)
    .slice(1)
    .map((part) => [part.slice(0, part.indexOf("\n")).trim(), `## ${part.trim()}`] as const),
);
for (const heading of Object.values(SECTIONS).flat())
  if (!bySection.has(heading)) throw new Error(`the translating skill has no "## ${heading}"`);

/**
 * How a kind of text is translated: the translating skill's sections for it, and for `<fbt>` text
 * fbtee's own rules first (fbtee's skill, steps 3 to 5, read from the app's installed fbtee by
 * vp dev: translate.ts fbteeRules), so every AI gets the same rules a coding agent reads.
 */
export function rulesFor(kind: Kind, fbtee?: string): string {
  return [
    ...(kind === "fbt" && fbtee ? [`## fbtee's own rules\n\n${fbtee}`] : []),
    ...SECTIONS[kind].map((h) => bySection.get(h)!),
  ].join("\n\n");
}

/** What every request says, whatever the kind: what it is, the rules, and how to reply. */
function instructions(
  kind: Kind,
  what: string,
  { from, to, fbtee }: { from: string; to: string; fbtee?: string },
  reply: string,
): string {
  const into = from === to ? `in ${named(to)} itself` : `from ${named(from)} into ${named(to)}`;
  return [`You translate ${what}, ${into}.`, rulesFor(kind, fbtee), reply].join("\n\n");
}

/** One catalog entry to translate: its description and its source lines, each maybe a form. */
export interface StringEntry {
  description: string;
  lines: { text: string; variations: Record<string, number> }[];
  /** Words to keep exactly as written: commands, file names, paths (translate.ts keptTerms). */
  keep?: string[];
  /** The code around the string, where it shows (translate.ts sourceContext). */
  context?: string;
}

/**
 * Translate an app's strings (fbtee catalog entries), by the rules void-fbtee's skill gives:
 * read the description, keep every {placeholder} exactly, one line per plural form, each in the
 * grammar of its form. Returns each entry's lines, in order.
 */
export async function translateStrings(
  entries: StringEntry[],
  {
    from,
    to,
    glossary = [],
    feedback,
    fbtee,
    onUsage,
  }: {
    from: string;
    to: string;
    /** Told each request's tokens. */
    onUsage?: (usage: Usage) => void;
    /** fbtee's own rules, from the app's installed fbtee (translate.ts fbteeRules). */
    fbtee?: string;
    /** The app's own words for terms these entries use (translate.ts glossaryFor). */
    glossary?: { source: string; translation: string }[];
    /** For one entry asked again: its last answer and what was wrong with it. */
    feedback?: { answer: string[]; problems: string[] };
  },
): Promise<string[][]> {
  const items = entries.map((e, i) => ({
    id: i,
    description: e.description,
    ...(e.keep?.length ? { keep_exactly: e.keep } : {}),
    ...(e.context ? { code: e.context } : {}),
    lines: e.lines.map((l) => ({
      form:
        Object.values(l.variations)
          .map((v) => MARKS[v] ?? `variation ${v}`)
          .join(", ") || "only",
      source: l.text,
    })),
  }));
  const out = await ask<{ entries: { id: number; lines: string[] }[] }>(
    instructions(
      "fbt",
      "the text of a web app's user interface",
      { from, to, fbtee },
      "Each entry comes with its description, its code (the source around it, to show where the " +
        "text appears), its keep_exactly words and its lines, each marked with its form. Reply " +
        "with JSON only.",
    ),
    (glossary.length
      ? `The app's own words for these terms: always use them, never another word:\n${JSON.stringify(glossary)}\n\n`
      : "") +
      `Translate from ${named(from)} into ${named(to)}:\n${JSON.stringify(items)}` +
      (feedback
        ? `\n\nYour last answer was ${JSON.stringify(feedback.answer)}. Change only what these points name; add nothing else:\n- ${feedback.problems.join("\n- ")}`
        : ""),
    {
      type: "object",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              lines: { type: "array", items: { type: "string" } },
            },
            required: ["id", "lines"],
          },
        },
      },
      required: ["entries"],
    },
    onUsage,
  );
  return entries.map((_, i) =>
    (out.entries?.find((e) => e.id === i)?.lines ?? []).map((l) =>
      typeof l === "string" ? l : "",
    ),
  );
}

/**
 * Translate a markdown page whole, by the rules void-fbtee's skill gives: the frontmatter's title
 * and description translated, its other keys and the `<script>` block kept, and every component
 * tag, code block, link target, heading id and marker kept exactly. Returns the page.
 */
export async function translatePage(
  text: string,
  { from, to, onUsage }: { from: string; to: string; onUsage?: (usage: Usage) => void },
): Promise<string> {
  const out = await ask<{ page: string }>(
    instructions(
      "page",
      "markdown pages of a website",
      { from, to },
      "Don't add a translatedFrom line. Reply with JSON only: the whole page as one string.",
    ),
    `Translate from ${named(from)} into ${named(to)}:\n${text}`,
    { type: "object", properties: { page: { type: "string" } }, required: ["page"] },
    onUsage,
  );
  return String(out.page ?? "");
}

/** What the dev server sends its route (plugin.ts). */
export type DevRequest =
  | {
      kind: "strings";
      from: string;
      to: string;
      entries: StringEntry[];
      glossary?: { source: string; translation: string }[];
      feedback?: { answer: string[]; problems: string[] };
      /** fbtee's own rules, from the app's installed fbtee (translate.ts fbteeRules). */
      fbtee?: string;
    }
  | { kind: "page"; from: string; to: string; text: string };

/**
 * The dev server's route, `POST /__void-fbtee/translate`: only under `vp dev` (the plugin's
 * virtual:void-fbtee/dev is empty in a build), and only for the dev server itself (the token it
 * made as it started). 503 when Void's AI isn't there (the app doesn't use it, or no Cloudflare
 * sign-in), so the dev server translates another way; 402 when the account's AI Gateway credits are
 * used up, 429 when a spend limit is reached; 502 when one answer was unusable.
 */
export async function devTranslate(request: Request, token: string): Promise<Response> {
  if (request.headers.get("x-void-fbtee-token") !== token)
    return new Response("not found", { status: 404 });
  const body = (await request.json()) as DevRequest;
  // Every request's tokens go back with its answer, a failed one's too: what it cost, for whoever
  // is counting (translate.ts, scripts/translations-measure.ts).
  const usage: Usage[] = [];
  const onUsage = (u: Usage) => usage.push(u);
  try {
    const result =
      body.kind === "page"
        ? { page: await translatePage(body.text, { ...body, onUsage }) }
        : { lines: await translateStrings(body.entries, { ...body, onUsage }) };
    return Response.json({ ...result, model: GEMINI.id, usage });
  } catch (error) {
    // 503: no Void's AI here (Void's own message, "ai: Not available…"); 402 and 429: the
    // account isn't paying for it now (models.ts paymentProblem); 502: it answered something
    // unusable, for this request only.
    const unavailable = /not available/i.test(String(error));
    const payment = paymentProblem(error);
    const status = unavailable ? 503 : payment === "credits" ? 402 : payment ? 429 : 502;
    return Response.json({ error: String(error), model: GEMINI.id, usage }, { status });
  }
}
