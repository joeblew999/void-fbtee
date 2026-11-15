// Translating with Void's AI (`ai` from `void/ai`: Workers AI), in the app's Worker. One
// translator for everything: what people post, at runtime (an app's queue calls translate()), and
// the app's own strings and pages while `vp dev` runs (the dev server's route calls
// translateStrings() and translatePage(): plugin.ts, devTranslate below).
//
// Void's AI is there wherever Void runs the app's code: dev, the preview and Cloudflare, in a
// route, a queue or a job (found 2026-11-13, plans/quiet-harbor-atlas.md, 7b). Void only connects
// it when the app's own files import `void/ai` (Void 1.8.0's binding inference reads the app's
// files, not its packages), so importing this module from void-fbtee changes nothing for an app
// without AI: ai.run then throws "Not available", and the dev server translates another way.
//
// Which model translates into which language, and why: models.ts.
import { ai } from "void/ai";
import { LLAMA, modelById, modelFor, type TranslationModel } from "./models";

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
  cache = false,
): Promise<T> {
  const result = await ai.run(
    model.id as never,
    {
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
      seed: 1,
    } as never,
    // Through the account's AI Gateway ("default", Cloudflare's own, made on a first request), so
    // every request is in the gateway's logs. Its cache is off for vp dev: a string is asked for
    // once, and its accepted answer is kept in the catalog. The translator test turns it on
    // (`cache`): at temperature 0 a cached answer is the one the model would give anyway, so a
    // rerun costs only the requests that changed, and a retry, which carries what was wrong, is a
    // new request, never cached. The binding's third argument, which Void passes on (AI Gateway
    // docs, "Workers Bindings"; Void's runtime/ai.mjs makeDirectBackend); proven both ways by
    // e2e/translator/cache.test.ts and the gateway's logs (2026-11-15).
    {
      gateway: { id: "default", ...(cache ? { cacheTtl: 7 * 86400 } : { skipCache: true }) },
    } as never,
  );
  const r = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const answer = r.response ?? r.choices?.[0]?.message?.content;
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
    `You translate ${about}. Translate naturally, the way a local would write it; keep names of ` +
      `people and places. Reply with JSON only: an object with the same keys.`,
    `From ${named(from)} into ${named(to)}:\n${JSON.stringify(fields)}`,
    {
      type: "object",
      properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])),
      required: keys,
    },
    modelFor(to),
  );
  return Object.fromEntries(keys.map((k) => [k, String(out[k] ?? "")])) as Record<K, string>;
}

/** fbtee's plural form codes, as its catalogs name them in each line's `variations`. */
const FORMS: Record<number, string> = {
  16: "zero",
  4: "one",
  8: "two",
  20: "few",
  12: "many",
  24: "other",
};

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
    guide,
    feedback,
    model,
    cache,
  }: {
    from: string;
    to: string;
    examples?: Example[];
    glossary?: { source: string; translation: string }[];
    guide?: string;
    /** The last answer and what was wrong with it, when it's asked again. */
    feedback?: { answer: string[]; problems: string[] };
    model?: string;
    /** AI Gateway's cache on (the translator test). */
    cache?: boolean;
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
          .map((v) => FORMS[v] ?? `variation ${v}`)
          .join(", ") || "only",
      source: l.text,
    })),
  }));
  const out = await ask<{ entries: { id: number; lines: string[] }[] }>(
    "You translate the text of a web app's user interface. For each entry, read its description " +
      "(where the text shows and what it means) and translate each line. Keep every {placeholder} " +
      "exactly as written, untranslated. A line marked with a plural form (zero, one, two, few, " +
      "many, other) is the sentence for counts in that form of the target language: write it in " +
      "that form's grammar; the zero, one and two forms may say the number in words instead of " +
      "{number}. Each entry's keep_exactly words (commands, file names, paths, product names) " +
      "stay exactly as written, in Latin letters, never translated or explained. The examples " +
      "are the app's own translations: use the same words for the same things, and the same " +
      "style. An entry's code is the source around it, to show where the text appears. " +
      `Write ${from === to ? `in ${named(to)} itself` : `in ${named(to)}`}. Reply with JSON only.` +
      (guide ? `\n\nThe project's own rules for translating it:\n${guide}` : ""),
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
    model ? modelById(model) : modelFor(to),
    cache,
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
    "You translate markdown pages of a website. Translate the prose, headings, list items, table " +
      "cells, link text, box and alert titles, and the frontmatter's title and description. Keep " +
      "exactly as written: the frontmatter's other keys and values, the <script> block, every " +
      "component tag with its props (<Name ... />), code blocks and inline code, link targets, " +
      "{#ids} and other {...} attributes, ::: and > [!NOTE] markers, [[toc]] and footnote labels. " +
      "Don't add a translatedFrom line. Reply with JSON only: the whole page as one string.",
    `From ${named(from)} into ${named(to)}:\n${text}`,
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
      guide?: string;
      feedback?: { answer: string[]; problems: string[] };
      cache?: boolean;
      /** The measurement only (scripts/translator.ts): another model to try. */
      model?: string;
    }
  | { kind: "page"; from: string; to: string; text: string }
  /** The meaning score (judge.ts): each pair is a source and its translation. */
  | { kind: "meaning"; pairs: [string, string][] }
  /** The cache test only (e2e/translator/cache.test.ts). */
  | { kind: "cache-probe"; cache: "on" | "off" };

/** Workers AI's multilingual embeddings model: Cloudflare, "100+ languages" (changelog 2025-03-17). */
export const MEANING_MODEL = "@cf/baai/bge-m3";

/**
 * How close each translation's meaning is to its source's, 0 to 1: the cosine of their
 * embeddings from one multilingual model, which puts a sentence and its translation near each
 * other. A signal for the judge (judge.ts), not a verdict: it misses a single wrong word in a long
 * sentence, and catches a translation that says something else.
 */
export async function meaningScores(pairs: [string, string][]): Promise<number[]> {
  if (!pairs.length) return [];
  const result = (await ai.run(
    MEANING_MODEL as never,
    { text: pairs.flat() } as never,
    { gateway: { id: "default", cacheTtl: 7 * 86400 } } as never,
  )) as { data?: number[][] };
  const v = result.data ?? [];
  const cos = (a: number[], b: number[]) => {
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  };
  return pairs.map((_, i) => cos(v[2 * i] ?? [], v[2 * i + 1] ?? []));
}

/**
 * One request that comes out differently each time the model answers it (a high temperature, no
 * seed), through AI Gateway's default gateway with its cache on (`cacheTtl`, seconds) or off
 * (`skipCache`). Cloudflare: the `id` is what sends a binding request through AI Gateway; "default"
 * is created on the first authenticated request (AI Gateway, "Workers Bindings", 2026-11-05). Two
 * answers word for word the same came from the cache. For the cache test, not for translating.
 */
async function cacheProbe(
  cache: "on" | "off",
): Promise<{ answer: string; headers: Record<string, string> }> {
  // The raw response (Void's direct backend returns it with `returnRawResponse`), for AI Gateway's
  // own headers: cf-aig-cache-status says HIT or MISS, cf-aig-log-id that the gateway saw it.
  const res = (await ai.run(
    LLAMA.id as never,
    {
      messages: [{ role: "user", content: "Write one short sentence about the sea." }],
      max_tokens: 64,
      temperature: 1.5,
    } as never,
    {
      gateway:
        cache === "on" ? { id: "default", cacheTtl: 300 } : { id: "default", skipCache: true },
      returnRawResponse: true,
    } as never,
  )) as unknown as Response;
  const headers = Object.fromEntries(
    [...res.headers].filter(([k]) => k.startsWith("cf-aig") || k === "content-type"),
  );
  const r = (await res.json()) as {
    response?: unknown;
    result?: { response?: unknown };
    choices?: { message?: { content?: unknown } }[];
  };
  const answer = r.response ?? r.result?.response ?? r.choices?.[0]?.message?.content;
  return { answer: typeof answer === "string" ? answer : JSON.stringify(answer ?? ""), headers };
}

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
    const result =
      body.kind === "strings"
        ? { lines: await translateStrings(body.entries, body) }
        : body.kind === "page"
          ? { page: await translatePage(body.text, body) }
          : body.kind === "meaning"
            ? { scores: await meaningScores(body.pairs) }
            : await cacheProbe(body.cache);
    return Response.json(result);
  } catch (error) {
    // 503: no Void's AI here (Void's own message, "ai: Not available…"); 502: it answered
    // something unusable, for this request only.
    const unavailable = /not available/i.test(String(error));
    return Response.json({ error: String(error) }, { status: unavailable ? 503 : 502 });
  }
}
