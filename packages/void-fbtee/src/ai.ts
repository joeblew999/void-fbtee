// Translating with Void's AI (`ai` from `void/ai`), in the app's Worker. One translator for
// everything: the app's own strings and pages while `vp dev` runs (the dev server's route,
// devTranslate below, which plugin.ts and translate.ts call), and what people post, at runtime (an
// app's queue: queues/translate.ts). What's sent and how the answer is read: gemini.ts.
//
// Void's AI is there wherever Void runs the app's code: dev, the preview and Cloudflare, in a
// route, a queue or a job (found 2026-11-13, plans/quiet-harbor-atlas.md, 7b). Void only connects
// it when the app's own files import `void/ai` (Void 1.8.0's binding inference reads the app's
// files, not its packages), so importing this module from void-fbtee changes nothing for an app
// without AI: ai.run then throws "Not available", and the dev server translates another way.
import { ai } from "void/ai";
import { isRecord, textRecord } from "./guards";
import {
  answerText,
  fieldsAnswer,
  isEntry,
  isGeminiAnswer,
  fieldsRequest,
  pageRequest,
  stringAnswer,
  stringRequest,
  usageOf,
  type Entry,
  type GeminiAnswer,
  type GeminiRequest,
} from "./gemini";
import { fieldProblems, problemsWith } from "./judge";
import { GEMINI, paymentAdvice, paymentProblem, spent, type Spent, type Usage } from "./models";

export { GEMINI, paymentProblem, paymentAdvice, type Spent, type Usage };

/** What's translated: the app's `<fbt>` text, what people post, a markdown page. */
export type Kind = "fbt" | "post" | "page";

/** What a request is tagged with in the gateway's logs. */
export interface Track {
  /** The app's name, in the gateway's logs (its package.json name). */
  app?: string;
}

/** One answer, with the tokens its request used and its AI Gateway log id. */
interface Asked {
  answer: GeminiAnswer;
  usage: Usage;
  logId?: string;
}

// Void's AI, for a model not in Cloudflare's own list: Void types `ai.run` with Workers AI's models,
// which Gemini (through AI Gateway) isn't one of; its runtime takes any model id and passes the
// body and options on. A typed view of the same function, which TypeScript checks.
const run: (model: string, body: object, options: object) => Promise<unknown> = ai.run.bind(ai);

/** One request to Gemini through Void's AI, in Gemini's own shape (gemini.ts). */
async function ask(body: GeminiRequest, { kind, app }: Track & { kind: Kind }): Promise<Asked> {
  const raw = await run(
    GEMINI.id,
    body,
    // Through the account's AI Gateway ("default", Cloudflare's own, made on a first request),
    // which a third-party model needs, and which logs every request; its cache off: a string is
    // asked for once, and its accepted answer is kept in the catalog (AI Gateway docs, "Workers
    // Bindings"; Void's runtime/ai.mjs makeDirectBackend passes this argument on).
    // Each request tagged (AI Gateway "Custom metadata", up to 5 keys): the app, whether it came
    // from `vp dev` or a built Worker (the live site, a Worker Preview, or `vp preview`), and what
    // it translated, so the gateway's logs, shared by every app on the account, can be told apart.
    // The raw response, for the gateway's log id (its cf-aig-log-id header): it names the exact
    // request and answer, and is stored with what the answer became.
    {
      gateway: {
        id: "default",
        skipCache: true,
        metadata: { app: app ?? "unnamed", build: import.meta.env.DEV ? "dev" : "build", kind },
        // What people post isn't kept in the gateway's logs: they can delete their post, and a
        // Worker can't delete a log (its binding only reads and annotates them; AI Gateway's
        // "Worker Binding Methods"). Unified Billing still logs the request's billing details
        // (model, tokens, cost) without the text (AI Gateway's "Logging", checked 2026-11-17),
        // so it keeps its log id. The app's own strings and pages are logged whole, to review.
        collectLog: kind !== "post",
      },
      returnRawResponse: true,
    },
  );
  let answer: unknown;
  let logId: string | undefined;
  if (raw instanceof Response) {
    logId = raw.headers.get("cf-aig-log-id") ?? undefined;
    // The status in the message: paymentProblem() reads a 402 from it (models.ts). A 429 never
    // gets here: Void's runtime throws its own "usage limit" error first, which it reads too.
    if (!raw.ok) throw new Error(`ai: ${raw.status}: ${await raw.text()}`);
    answer = await raw.json();
  } else answer = raw;
  if (!isGeminiAnswer(answer)) throw new Error(`${GEMINI.id}: an answer not in Gemini's shape`);
  return { answer, usage: usageOf(answer), logId };
}

/** An answer's text, which must be complete; parsed as JSON when `json`. */
function read(asked: Asked, json: boolean): unknown {
  const { text, complete } = answerText(asked.answer);
  if (!complete) throw new Error(`${GEMINI.id} gave no complete answer`);
  if (!json) return text;
  try {
    return JSON.parse(text);
  } catch (error) {
    // Say what came back, so a shape we don't read yet can be seen and fixed.
    throw new Error(
      `${GEMINI.id}'s answer isn't JSON: ${String(error)}; it begins ${JSON.stringify(text.slice(0, 200))}`,
    );
  }
}

/**
 * Each line with its source line's own leading and trailing spaces, whatever the model gave: some
 * lines are pieced together around other text (a Thai answer once began " {name} จอง…",
 * 2026-11-15).
 */
const spaced = (entry: Entry, lines: (string | undefined)[]) =>
  lines.map((l, i) => {
    if (l === undefined) return undefined;
    const src = entry.lines[i]?.text ?? "";
    return src.match(/^\s*/)![0] + l.trim() + src.match(/\s*$/)![0];
  });

/** A translation, what was still wrong with it (nothing: it's right), what it cost, and its log. */
export interface Translated<T> {
  result: T;
  problems: string[];
  usage: Spent;
  logId?: string;
}

/**
 * One of the app's strings (a catalog entry, its lines in the source language) into `to`: asked,
 * checked (judge.ts problemsWith), and asked once more, told what was wrong, if anything was. Its
 * lines, in the entry's order; any problems left mean it isn't to be kept.
 */
export async function translateString(
  entry: Entry,
  { from, to, ...track }: { from: string; to: string } & Track,
): Promise<Translated<(string | undefined)[]>> {
  const source = entry.lines.map((l) => ({ translation: l.text, variations: l.variations }));
  const usages: Usage[] = [];
  let retry: { answer: unknown; problems: string[] } | undefined;
  for (;;) {
    const asked = await ask(stringRequest(entry, { from, to, retry }), { ...track, kind: "fbt" });
    usages.push(asked.usage);
    const answer = read(asked, true);
    const lines = spaced(entry, stringAnswer(entry, answer));
    const problems = problemsWith(source, lines, to);
    if (!problems.length || retry)
      return { result: lines, problems, usage: spent(usages), logId: asked.logId };
    retry = { answer, problems };
  }
}

/**
 * A post's fields (an event's title and description, say) into `to`, by name: asked, checked
 * (judge.ts fieldProblems), and asked once more if anything was wrong. Still wrong: an error, so
 * the queue tries again later (queues/translate.ts).
 */
export async function translateFields(
  fields: Record<string, string>,
  { from, to, ...track }: { from: string; to: string } & Track,
): Promise<Translated<Record<string, string>>> {
  const usages: Usage[] = [];
  let retry: { answer: unknown; problems: string[] } | undefined;
  for (;;) {
    const asked = await ask(fieldsRequest(fields, { from, to, retry }), {
      ...track,
      kind: "post",
    });
    usages.push(asked.usage);
    const answer = read(asked, true);
    const got = fieldsAnswer(fields, answer);
    const problems = fieldProblems(fields, got);
    if (!problems.length)
      return {
        result: textRecord(got),
        problems,
        usage: spent(usages),
        logId: asked.logId,
      };
    if (retry) throw new Error(`a post's translation into ${to} still has: ${problems.join(" ")}`);
    retry = { answer, problems };
  }
}

/** A markdown page into `to`, whole: the page, as Gemini wrote it. */
export async function translatePage(
  text: string,
  { from, to, ...track }: { from: string; to: string } & Track,
): Promise<Translated<string>> {
  const asked = await ask(pageRequest(text, { from, to }), { ...track, kind: "page" });
  return {
    result: String(read(asked, false)),
    problems: [],
    usage: spent([asked.usage]),
    logId: asked.logId,
  };
}

/** What the dev server sends its route (dev/translate.ts routeCall). */
/** A request to the dev route, each field it has checked. */
const isDevRequest = (value: unknown): value is DevRequest =>
  isRecord(value) &&
  typeof value.from === "string" &&
  typeof value.to === "string" &&
  (value.app === undefined || typeof value.app === "string") &&
  ((value.kind === "string" && isEntry(value.entry)) ||
    (value.kind === "page" && typeof value.text === "string") ||
    (value.kind === "post" &&
      isRecord(value.fields) &&
      Object.values(value.fields).every((v) => typeof v === "string")));

export type DevRequest = {
  /** The app's name, for the gateway's logs (its package.json name). */
  app?: string;
  from: string;
  to: string;
} & (
  | { kind: "string"; entry: Entry }
  | { kind: "page"; text: string }
  | { kind: "post"; fields: Record<string, string> }
);

/**
 * The dev server's route, `POST /__void-fbtee/translate`: only under `vp dev` (the plugin's
 * virtual:void-fbtee/dev is empty in a build), and only with the token the dev server made as it
 * started (node_modules/.void-fbtee/dev-token). It writes nothing: it answers with the
 * translation, what was still wrong with it, its cost and its log id; whoever asked keeps it or
 * not. 503 when Void's AI isn't there (the app doesn't use it, or no Cloudflare sign-in); 402
 * when the account's AI Gateway credits are used up, 429 when a spend limit is reached; 502 when
 * the answer was unusable.
 */
export async function devTranslate(request: Request, token: string): Promise<Response> {
  if (request.headers.get("x-void-fbtee-token") !== token)
    return new Response("not found", { status: 404 });
  const body: unknown = await request.json();
  if (!isDevRequest(body)) return new Response("not a translation request", { status: 400 });
  const track = { from: body.from, to: body.to, app: body.app };
  try {
    const done =
      body.kind === "page"
        ? await translatePage(body.text, track)
        : body.kind === "post"
          ? await translateFields(body.fields, track)
          : await translateString(body.entry, track);
    return Response.json({ ...done, model: GEMINI.id });
  } catch (error) {
    // 503: no Void's AI here (Void's own message, "ai: Not available…"); 402 and 429: the
    // account isn't paying for it now (models.ts paymentProblem); 502: it answered something
    // unusable, for this request only.
    const unavailable = /not available/i.test(String(error));
    const payment = paymentProblem(error);
    const status = unavailable ? 503 : payment === "credits" ? 402 : payment ? 429 : 502;
    return Response.json({ error: String(error), model: GEMINI.id }, { status });
  }
}
