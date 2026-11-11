// "Format on the server": the formats page posts what the visitor typed, written their language's
// way, and the Worker reads it back as a plain number and formats it again with its own Intl.
import { defineHandler } from "void";
import { parseNumber } from "../../lib/parse-number";
import { tryIt } from "../../lib/try-it";

export const POST = defineHandler(async (c) => {
  const { locale, number, text } = (await c.req.json()) as {
    locale: string;
    number: string;
    text: string;
  };
  return tryIt(locale, parseNumber(locale, number), text);
});
