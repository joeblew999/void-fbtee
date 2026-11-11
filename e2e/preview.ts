// `vp run deploy:preview`: the example as a Cloudflare Worker Preview of this branch, beside production
// (https://developers.cloudflare.com/workers/previews/). Workers Builds runs it for every branch but main;
// it works here too, logged in with `cf` (`cf auth activate <profile>` in apps/example).
//
// Void has no preview deploy, so: Void builds as usual, with CLOUDFLARE_PREVIEW_BUILD=true, the switch
// Cloudflare's Vite plugin reads to write Preview Build Output; then Cloudflare's cf uploads it
// (`cf previews deploy --prebuilt`, https://developers.cloudflare.com/cf/projects/#deploy-a-preview), named
// after the branch, which cf reads from Workers Builds or git. Two things in Void's output a preview
// can't take, changed in between:
// - the queue consumer (`triggers`): "Queue consumers cannot target a Preview", so production's
//   consumer does that work;
// - a queue's name: Void names the queue on Cloudflare "<Worker>-<queue>" when it deploys
//   (void-fbtee-example-translate), and the Build Output has the short name.
// A preview shares production's D1, KV and queue; Cloudflare gives it its own Durable Objects.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = join(import.meta.dirname, "../apps/example");
const run = (cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) => {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run("vp", ["run", "-t", "example#build"], undefined, { CLOUDFLARE_PREVIEW_BUILD: "true" });

const file = join(app, ".cloudflare/output/v0/workers/default/worker.config.json");
const worker = JSON.parse(readFileSync(file, "utf8")) as {
  name: string;
  triggers?: unknown;
  env: Record<string, { type: string; name?: string }>;
};
delete worker.triggers;
for (const binding of Object.values(worker.env))
  if (binding.type === "queue" && binding.name && !binding.name.startsWith(`${worker.name}-`))
    binding.name = `${worker.name}-${binding.name}`;
writeFileSync(file, JSON.stringify(worker));

run("vp", ["exec", "cf", "previews", "deploy", "--prebuilt", "--mode", "production"], app);
