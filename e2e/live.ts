// `vp run deploy:test`: Void's deploy, then the read-only browser tests against the URL Void
// reports (its summary box, `+- https://… --+`, then "Successfully deployed!"). The events and dev
// tests write data or need the dev server, so they stay local.
import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";

const deploy = spawn("vp", ["run", "deploy"], { stdio: ["inherit", "pipe", "inherit"] });
let output = "";
deploy.stdout.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk);
  output += chunk;
});
const code: number = await new Promise((resolve) => deploy.on("close", (c) => resolve(c ?? 1)));
const plain = stripVTControlCharacters(output);
const url = /^\+- (https:\/\/\S+) -+\+$/m.exec(plain)?.[1];
if (code !== 0 || !plain.includes("Successfully deployed!") || !url) {
  console.error("deploy:test: no successful deploy with a URL, so no tests");
  process.exit(code || 1);
}
console.log(`\ndeploy:test: testing ${url}\n`);
const files = ["server", "pages", "formats", "islands"].map((f) => `e2e/${f}.test.ts`);
const tests = spawn("vp", ["test", "run", ...files], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
