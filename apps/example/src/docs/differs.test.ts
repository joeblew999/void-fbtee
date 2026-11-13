// The reference pages' difference helpers: invisible characters shown by name, and two lists of
// supported values compared. Plain string code, so it runs under `vp test` in Node.
import { expect, test } from "vite-plus/test";
import { listDifference, showInvisible } from "./differs";

test("showInvisible names the characters that print as nothing or as a plain space", () => {
  // An Arabic date's right-to-left mark, and the narrow no-break space before "PM".
  expect(showInvisible("‏١٢/٣ PM")).toBe("⟨RLM⟩١٢/٣⟨NNBSP⟩PM");
  expect(showInvisible("⁦x⁩ y")).toBe("⟨LRI⟩x⟨PDI⟩⟨NBSP⟩y");
  // Ordinary text, spaces included, is left as it is.
  expect(showInvisible("6:30 PM")).toBe("6:30 PM");
});

test("listDifference says which values only one side supports, ignoring the count", () => {
  expect(listDifference("3: buddhist, gregory, islamic", "2: gregory, japanese")).toEqual({
    onlyWorker: ["buddhist", "islamic"],
    onlyBrowser: ["japanese"],
  });
  expect(listDifference("2: a, b", "2: b, a")).toEqual({ onlyWorker: [], onlyBrowser: [] });
  expect(listDifference("0: ", "1: a")).toEqual({ onlyWorker: [], onlyBrowser: ["a"] });
});
