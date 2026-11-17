// Translating with Void's AI (`ai` from `void/ai`: Workers AI), in the app's Worker. One
// translator for everything: what people post, at runtime (an app's queue calls translate()), and
// the app's own strings and pages while `vp dev` runs (the dev server's route calls
// translateStrings() and translatePage(): plugin.ts, devTranslate below). Each is told how to
// translate by the translating skill (skills/void-fbtee-translate/SKILL.md, bundled into the code:
// TRANSLATING), the text a coding agent reads too: instructions() below, the one place a request
// is worded.
//
// Void's AI is there wherever Void runs the app's code: dev, the preview and Cloudflare, in a
// route, a queue or a job (found 2026-11-13, plans/quiet-harbor-atlas.md, 7b). Void only connects
// it when the app's own files import `void/ai` (Void 1.8.0's binding inference reads the app's
// files, not its packages), so importing this module from void-fbtee changes nothing for an app
// without AI: ai.run then throws "Not available", and the dev server translates another way.
//
// Which model translates into which language, and why: models.ts.
import { ai } from "void/ai";
import skill from "../skills/void-fbtee-translate/SKILL.md?raw";
import {
  GEMINI,
  LLAMA,
  modelById,
  modelFor,
  thirdParty,
  type TranslationModel,
  type Usage,
} from "./models";

export { GEMINI, type Usage };
import { MARKS } from "./plurals";

/**
 * How to translate: the translating skill (skills/void-fbtee-translate/SKILL.md), the same text a
 * coding agent reads, bundled into the code so it travels with it. Its frontmatter is the
 * skill's own label, not a rule.
 */
export const TRANSLATING = skill.replace(/^---\n[\s\S]*?\n---\n+/, "").trim();

/** A language's English name, for the prompt ("Thai" for "th-TH"). */
const named = (locale: string) =>
  new Intl.DisplayNames("en", { type: "language" }).of(locale) ?? locale;

/**
 * Ask a model for JSON of a given shape. With JSON Mode, Workers AI holds the answer to the schema;
 * a model without it (models.ts) is given the schema in the prompt, and the JSON is read from its
 * answer's text. Workers AI answers in its own shape ({ response }) or OpenAI's ({ choices }).
 */
async function ask<T>(
  system: string,
  user: string,
  schema: object,
  model: TranslationModel = LLAMA,
  onUsage?: (usage: Usage) => void,
): Promise<T> {
  const input = {
    messages: [
      {
        role: "system",
        content: model.jsonMode
          ? system
          : `${system}\n\nReply with one JSON object and nothing else, no code fence, matching this JSON Schema: ${JSON.stringify(schema)}`,
      },
      { role: "user", content: user },
    ],
    ...(model.jsonMode ? { response_format: { type: "json_schema", json_schema: schema } } : {}),
    // Workers AI's default is 256 tokens, which cuts a page or a batch of strings off mid-JSON.
    max_tokens: 8192,
    // A translation, not a story: the model's most likely answer, and the same one for the same
    // request. Workers AI's default is 0.6 for some models and 0.15 for others (each model's
    // page, "temperature", 0 to 5, checked 2026-11-15); `seed` is its own reproducibility knob.
    temperature: 0,
    // A third-party model gets only what Chat Completions has: AI Gateway rejects fields a model
    // doesn't take (developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/).
    ...(thirdParty(model) ? {} : { seed: 1 }),
    // Its thinking off or at its lowest (models.json): a translation needs none.
    ...model.options,
  };
  const result = await ai.run(
    model.id as never,
    input as never,
    // Through the account's AI Gateway ("default", Cloudflare's own, made on a first request), so
    // every request is in the gateway's logs; its cache off: a string is asked for once, and its
    // accepted answer is kept in the catalog. The binding's third argument, which Void passes on
    // (AI Gateway docs, "Workers Bindings"; Void's runtime/ai.mjs makeDirectBackend).
    {
      gateway: { id: "default", skipCache: true },
      // One replica per model, so the system prompt, the same for every string, is prefix-cached
      // across requests (Workers AI's "Prompt caching" page: x-session-affinity, through the
      // binding's extraHeaders, checked 2026-11-15). Workers AI's own models only.
      ...(thirdParty(model)
        ? {}
        : { extraHeaders: { "x-session-affinity": `void-fbtee-${model.id}` } }),
    } as never,
  );
  const r = result as {
    response?: unknown;
    choices?: { message?: { content?: unknown }; finish_reason?: string }[];
    usage?: Usage;
  };
  if (onUsage && r.usage) onUsage(r.usage);
  const answer = r.response ?? r.choices?.[0]?.message?.content;
  // No answer: a thinking model that spent max_tokens thinking (GLM 4.7 Flash's 8192 tokens, all
  // reasoning, content null, in the gateway's logs, 2026-11-15) or one cut off mid-answer.
  if (answer === null || answer === undefined || r.choices?.[0]?.finish_reason === "length")
    throw new Error(
      `${model.id} gave no complete answer (${r.choices?.[0]?.finish_reason ?? "no content"})`,
    );
  if (typeof answer !== "string") return answer as T;
  // Without JSON Mode, the object may come with words or a fence around it.
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? answer.slice(start, end + 1) : answer) as T;
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
    // The language to write in, said again with the text: given only in the system prompt, Gemma
    // 4 sometimes answers with the text unchanged (a Thai post left in English, AI Gateway's logs,
    // 2026-11-16), as the strings' request already says it.
    `Translate from ${named(from)} into ${named(to)}:\n${JSON.stringify(fields)}`,
    {
      type: "object",
      properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])),
      required: keys,
    },
    modelFor(to),
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

/** A string the app already has in the target language, to match its words and style. */
export interface Example {
  description: string;
  source: string;
  translation: string;
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
    examples = [],
    glossary = [],
    feedback,
    fbtee,
    model,
    onUsage,
  }: {
    from: string;
    to: string;
    /** The model to ask, instead of the language's own (models.ts): for measuring. */
    model?: TranslationModel;
    /** Told each request's tokens. */
    onUsage?: (usage: Usage) => void;
    /** fbtee's own rules, from the app's installed fbtee (translate.ts fbteeRules). */
    fbtee?: string;
    examples?: Example[];
    glossary?: { source: string; translation: string }[];
    /** The last answer and what was wrong with it, when it's asked again. */
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
      (examples.length
        ? `The app's own translations from ${named(from)} into ${named(to)}, for its words and style:\n${JSON.stringify(examples)}\n\n`
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
    model ?? modelFor(to),
    onUsage,
  );
  // A model without JSON Mode may give a line as an object ({ "form": "other", "target": "…" }):
  // its translation, not its first field (SEA-LION's Thai once read "other", 2026-11-15).
  const lineOf = (o: Record<string, unknown>) => {
    for (const k of ["translation", "target", "text", "line", "output"])
      if (typeof o[k] === "string") return o[k];
    const strings = Object.values(o).filter((v): v is string => typeof v === "string");
    return strings.sort((a, b) => b.length - a.length)[0] ?? "";
  };
  const text = (l: unknown): string =>
    typeof l === "string"
      ? l
      : l && typeof l === "object"
        ? lineOf(l as Record<string, unknown>)
        : "";
  return entries.map((_, i) => (out.entries?.find((e) => e.id === i)?.lines ?? []).map(text));
}

/**
 * Translate a markdown page whole, by the rules void-fbtee's skill gives: the frontmatter's title
 * and description translated, its other keys and the `<script>` block kept, and every component
 * tag, code block, link target, heading id and marker kept exactly. Returns the page.
 */
export async function translatePage(
  text: string,
  { from, to }: { from: string; to: string },
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
    modelFor(to),
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
      examples?: Example[];
      glossary?: { source: string; translation: string }[];
      feedback?: { answer: string[]; problems: string[] };
      /** fbtee's own rules, from the app's installed fbtee (translate.ts fbteeRules). */
      fbtee?: string;
      /** A model's id to ask instead of the language's own: for measuring (GEMINI or models.json). */
      model?: string;
    }
  | { kind: "page"; from: string; to: string; text: string };

/**
 * The dev server's route, `POST /__void-fbtee/translate`: only under `vp dev` (the plugin's
 * virtual:void-fbtee/dev is empty in a build), and only for the dev server itself (the token it
 * made as it started). 503 when Void's AI isn't there (the app doesn't use it, or no Cloudflare
 * sign-in), so the dev server translates another way; 502 when one answer was unusable.
 */
export async function devTranslate(request: Request, token: string): Promise<Response> {
  if (request.headers.get("x-void-fbtee-token") !== token)
    return new Response("not found", { status: 404 });
  const body = (await request.json()) as DevRequest;
  try {
    if (body.kind === "page") return Response.json({ page: await translatePage(body.text, body) });
    const model = body.model
      ? body.model === GEMINI.id
        ? GEMINI
        : modelById(body.model)
      : modelFor(body.to);
    const usage: Usage[] = [];
    const lines = await translateStrings(body.entries, {
      ...body,
      model,
      onUsage: (u) => usage.push(u),
    });
    return Response.json({ lines, model: model.id, usage });
  } catch (error) {
    // 503: no Void's AI here (Void's own message, "ai: Not available…"); 502: it answered
    // something unusable, for this request only.
    const unavailable = /not available/i.test(String(error));
    return Response.json({ error: String(error) }, { status: unavailable ? 503 : 502 });
  }
}
