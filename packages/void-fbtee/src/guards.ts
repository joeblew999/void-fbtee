// Checks that make a value read at run time a type (plans/no-casts.md): JSON from a file, an AI's
// answer, a request's body. Each one looks at the value; none just says what it is. Used where the
// package once wrote a cast (`as …`), which the lint rule now forbids.

/** A plain object: not null, not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A list of text. */
export const isStringArray = (value: unknown): value is Array<string> =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

/** A field of an object, or undefined when the value isn't one. */
export const field = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

/** A field of an object when it's text, else undefined. */
export const textField = (value: unknown, key: string): string | undefined => {
  const v = field(value, key);
  return typeof v === "string" ? v : undefined;
};

/** JSON's value, as unknown: what it holds is for a check to say. */
export const parseJson = (text: string): unknown => JSON.parse(text);

/** An object of text values: each field that isn't text left out. */
export const textRecord = (value: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(isRecord(value) ? value : {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

/** A regular expression's capture group that its pattern always fills: checked, so a change to the
 * pattern that leaves it empty is an error rather than an undefined passed on. */
export function group(match: ReadonlyArray<string | undefined>, i: number): string {
  const found = match[i];
  if (found === undefined) {
    throw new Error(`void-fbtee: no group ${i} in ${JSON.stringify(match[0])}`);
  }
  return found;
}

/** A list's item that the code's own logic says is there (an index from its own loop, a value it
 * just found): checked, so a slip is an error naming `what`, not an undefined passed on. */
export function present<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`void-fbtee: ${what} is missing`);
  }
  return value;
}
