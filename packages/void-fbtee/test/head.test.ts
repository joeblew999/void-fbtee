// void-fbtee/head: unhead's unpackMeta in Void's meta shape, and a page's title and description
// for search results and link previews. Pure functions: no app.
import { expect, test } from "vite-plus/test";
import { meta, pageHead } from "../src/head";

test("meta: Open Graph as property, the rest as name, every value text, empty ones left out", () => {
  expect(
    meta({
      ogSiteName: "Acme",
      ogImage: { url: "https://acme.example/og.png", width: 1200, height: 630 },
      twitterCard: "summary_large_image",
      description: "",
    }),
  ).toEqual([
    { property: "og:image", content: "https://acme.example/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:site_name", content: "Acme" },
    { name: "twitter:card", content: "summary_large_image" },
  ]);
});

test("pageHead: the title and description, and the same two for link previews", () => {
  // As fbs() returns: an object that is text when made a string.
  const translated = (text: string) => ({ toString: () => text });
  expect(pageHead({ title: translated("กิจกรรม"), description: translated("คำอธิบาย") })).toEqual({
    title: "กิจกรรม",
    meta: [
      { name: "description", content: "คำอธิบาย" },
      { property: "og:title", content: "กิจกรรม" },
      { property: "og:description", content: "คำอธิบาย" },
    ],
  });
});
