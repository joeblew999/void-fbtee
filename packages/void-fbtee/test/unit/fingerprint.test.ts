// The fingerprint (fingerprint.ts), in plain JavaScript for the Worker, is exactly Node's SHA-256:
// pages translated before keep their `translatedFrom`.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fingerprint, sha256 } from "../../src/fingerprint";

const node = (text: string) => createHash("sha256").update(text).digest("hex");

test("the same as Node's SHA-256, for empty, short, multi-block and non-Latin text", () => {
  // FIPS 180-4's own example.
  expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  for (const text of [
    "",
    "a",
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(64),
    "x".repeat(1000),
    "เวิร์กช็อปขนมไทยโบราณ",
    "أمسية خط عربي 🎨",
    JSON.stringify({ title: "Night market", description: "Street food." }),
  ]) {
    expect(sha256(text), JSON.stringify(text.slice(0, 20))).toBe(node(text));
  }
});

test("a whole markdown page: the same 12 characters as Node's", () => {
  const page = readFileSync(
    join(import.meta.dirname, "../../../../apps/example/pages/en-US/docs/tour.md"),
    "utf8",
  );
  expect(fingerprint(page)).toBe(node(page).slice(0, 12));
});
