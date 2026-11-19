// The package's types come from the app's own schema and pages (plans/types-from-schema.md): a
// wrong table, field or page doesn't compile. Checked by `vp check` (the type check), with
// `@ts-expect-error` marking each line that must fail; the test itself only keeps the file in the
// unit run. Types only: nothing here runs the Worker's code.
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import type { bookings, events, events_translations } from "@schema";
import type { LangPage, LangPagePattern } from "void-fbtee/server";

type Content = typeof import("@/content").content;
type Fields = (typeof events_translations.$inferSelect)["fields"];

describe("types from the schema", () => {
  it("types the content functions by the app's tables", () => {
    // A translated table's fields are its own columns' types.
    expectTypeOf<Fields>().toEqualTypeOf<{ title: string; description: string }>();
    type TextOf = ReturnType<Content["textOf"]>["fields"];
    expectTypeOf<TextOf>().toEqualTypeOf<Fields>();
    type Stored = Awaited<ReturnType<Content["translationsFor"]>>[number]["fields"];
    expectTypeOf<Stored>().toEqualTypeOf<Fields>();
    const check = (c: Content, e: typeof events, b: typeof bookings) => {
      void c.translateSoon(e, "id");
      // @ts-expect-error bookings has no translations table
      void c.translateSoon(b, "id");
      // @ts-expect-error a table's name isn't a table
      void c.translateSoon("events", "id");
      void c.storeTranslation(e, "id", "th-TH", { title: "t", description: "d" }, { by: "x" });
      // @ts-expect-error a field events_translations doesn't translate
      void c.storeTranslation(e, "id", "th-TH", { title: "t", venue: "v" }, { by: "x" });
    };
    expect(check).toBeTypeOf("function");
  });

  it("types the pages by Void's own route types", () => {
    expectTypeOf<"/[lang]/docs">().toExtend<LangPage>();
    expectTypeOf<"/[lang]/events/[id]">().toExtend<LangPagePattern>();
    // @ts-expect-error not a page
    expectTypeOf<"/[lang]/nope">().toExtend<LangPage>();
    // @ts-expect-error a page with another parameter isn't listed by itself
    expectTypeOf<"/[lang]/events/[id]">().toExtend<LangPage>();
  });
});
