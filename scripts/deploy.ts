// `vp run deploy` (and `deploy:atomic`, with --atomic): the example's deploy (Void's
// `void deploy`), with its output as it comes. Void
// prints the URL it deployed to (its summary box) and keeps no record of it,
// so this saves it (scripts/production-url.ts) for `vp run test:deployed` and `test:production`.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { PRODUCTION_URL } from "./production-url";

const task = process.argv.includes("--atomic") ? "example#deploy:atomic" : "example#deploy";
const child = spawn("vp", ["run", task], {
  stdio: ["inherit", "pipe", "inherit"],
});
let output = "";
child.stdout.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk);
  output += chunk;
});
const code: number = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 1)));
const plain = stripVTControlCharacters(output);
// Void draws the box in plain characters where the terminal can't show box lines (`+- https://… --+`)
// and in box lines where it can, as GitHub's runners (`╭─ https://… ─╮`).
const url = /^(?:\+-|╭─) (https:\/\/\S+) [-─]+[+╮]$/m.exec(plain)?.[1];
if (code === 0 && plain.includes("Successfully deployed!") && url) {
  mkdirSync(dirname(PRODUCTION_URL), { recursive: true });
  writeFileSync(PRODUCTION_URL, url);
}
process.exit(code);
