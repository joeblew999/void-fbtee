// `vp run deploy` (and `deploy:atomic`, with --atomic): the example's deploy (Void's
// `void deploy`), with its output as it comes. Void
// prints the URL it deployed to (its summary box, `+- https://… --+`) and keeps no record of it,
// so this saves it in .e2e-work/live-url for `vp run test:live`.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

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
const url = /^\+- (https:\/\/\S+) -+\+$/m.exec(plain)?.[1];
if (code === 0 && plain.includes("Successfully deployed!") && url) {
  const saved = join(import.meta.dirname, "../.e2e-work/live-url");
  mkdirSync(join(saved, ".."), { recursive: true });
  writeFileSync(saved, url);
}
process.exit(code);
