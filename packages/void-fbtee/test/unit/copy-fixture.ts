// A fresh copy of the fixture app (test/unit/fixture) for a test to change: inside this folder, so
// fbtee and the rest resolve from the package's own node_modules. The caller removes it.
import { cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE = join(import.meta.dirname, "fixture");

export function copyFixture(): string {
  const root = mkdtempSync(join(import.meta.dirname, ".tmp-"));
  cpSync(FIXTURE, root, { recursive: true });
  return root;
}
