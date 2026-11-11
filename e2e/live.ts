// The browser tests against the deployed site, at the URL Void reported when it deployed (its
// summary box, `+- https://… --+`, then "Successfully deployed!"). Void keeps no record of it, so
// this script saves it in .e2e-work/live-url.
//   vp run deploy:test   Void's deploy, then the tests on the URL it reports
//   vp run test:live     the tests on the URL of the last deploy:test
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";

const saved = join(import.meta.dirname, "../.e2e-work/live-url");

async function deploy(): Promise<string> {
  const child = spawn("vp", ["run", "deploy"], { stdio: ["inherit", "pipe", "inherit"] });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    output += chunk;
  });
  const code: number = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 1)));
  const plain = stripVTControlCharacters(output);
  const url = /^\+- (https:\/\/\S+) -+\+$/m.exec(plain)?.[1];
  if (code !== 0 || !plain.includes("Successfully deployed!") || !url) {
    console.error("live: no successful deploy with a URL, so no tests");
    process.exit(code || 1);
  }
  mkdirSync(join(saved, ".."), { recursive: true });
  writeFileSync(saved, url);
  return url;
}

function lastDeploy(): string {
  try {
    return readFileSync(saved, "utf8").trim();
  } catch {
    console.error("live: no deploy yet: run `vp run deploy:test` first");
    process.exit(1);
  }
}

const url = process.argv.includes("--deploy") ? await deploy() : lastDeploy();
console.log(`\nlive: testing ${url}\n`);
const tests = spawn("vp", ["test", "run", "e2e"], {
  stdio: "inherit",
  env: { ...process.env, E2E_URL: url },
});
tests.on("close", (c) => process.exit(c ?? 1));
