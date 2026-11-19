// `vp run build:preview`: the example's build as Preview Build Output, for a Cloudflare Worker Preview of
// this branch beside production (https://developers.cloudflare.com/workers/previews/). Then
// `npx cf previews deploy --prebuilt --mode production` in apps/example uploads it, named after the branch
// (cf reads it from git): `vp run deploy:preview` does both.
//
// Void has no preview deploy, so Void builds as usual, with CLOUDFLARE_PREVIEW_BUILD=true, the switch
// Cloudflare's Vite plugin reads to write Preview Build Output
// (https://developers.cloudflare.com/cf/projects/#deploy-a-preview). Two things in Void's output a
// preview can't take are changed here:
// - the queue consumer (`triggers`): "Queue consumers cannot target a Preview", so production's
//   consumer does that work;
// - a queue's name: Void names the queue on Cloudflare "<Worker>-<queue>" when it deploys
//   (void-fbtee-example-translate), and the Build Output has the short name.
// A preview shares production's D1, KV and queue; Cloudflare gives it its own Durable Objects.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { field, isRecord, parseJson, textField } from "../packages/void-fbtee/src/guards";

const app = join(import.meta.dirname, "../apps/example");
const run = (cmd: string, args: Array<string>, cwd?: string, env?: NodeJS.ProcessEnv) => {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
};

run("vp", ["run", "-t", "void-fbtee-example#build"], undefined, {
  CLOUDFLARE_PREVIEW_BUILD: "true",
});

const file = join(app, ".cloudflare/output/v0/workers/default/worker.config.json");
const worker = parseJson(readFileSync(file, "utf8"));
const workerName = textField(worker, "name");
const bindings = field(worker, "env");
if (!isRecord(worker) || !workerName || !isRecord(bindings)) {
  throw new Error(`${file} isn't the Worker config Void writes: it has no name or env`);
}
delete worker.triggers;
for (const binding of Object.values(bindings)) {
  const name = textField(binding, "name");
  if (isRecord(binding) && binding.type === "queue" && name && !name.startsWith(`${workerName}-`)) {
    binding.name = `${workerName}-${name}`;
  }
}
writeFileSync(file, JSON.stringify(worker));
