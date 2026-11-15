#!/usr/bin/env node
// The void-fbtee command: setup only. Run it in the app's folder, as `vp exec void-fbtee init`.
// Everything after setup is Vite+'s own commands: `vp dev` prepares, translates and reports,
// `vp build` fails on anything left, `vp check` runs fbtee's lint rules.
import { parseArgs } from "node:util";
import { init } from "./init";

const USAGE = `Usage: void-fbtee init [--root <dir>] [--source-locale <locale>] [--locales <list>] [--site <address>]

Wires void-fbtee into a \`void init\` app: the Vite plugin, the middleware, the layout's
<I18nProvider>, Cloudflare's temporal flag, tsconfig, fbtee's lint rules and AGENTS.md. Only adds
what's missing; safe to run again. Then: vp dev translates as you work, vp build checks.

Options:
  --root <dir>              The app's folder (default: the current folder).
  --source-locale <locale>  The language the code is written in (default en-US).
  --locales <list>          Comma-separated locales, source first (default: the source only).
  --site <address>          The site's own address, e.g. https://example.com (voidFbtee({ site })).
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      "source-locale": { type: "string" },
      locales: { type: "string" },
      site: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    return;
  }
  const root = values.root ?? process.cwd();
  if (command === "init") {
    const sourceLocale = values["source-locale"] ?? "en-US";
    const rest = (values.locales ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    const locales = [sourceLocale, ...rest.filter((l) => l !== sourceLocale)];
    const { done, todo } = await init({ root, sourceLocale, locales, site: values.site });
    for (const line of done) console.log(`✓ ${line}`);
    if (!done.length) console.log("void-fbtee is already wired in; nothing to change");
    if (todo.length) console.log("\nnext:");
    for (const line of todo) console.log(`  - ${line}`);
    return;
  }
  process.stderr.write(`void-fbtee: unknown command "${command}"\n\n${USAGE}`);
  process.exitCode = 2;
}

await main().catch((error: Error) => {
  process.stderr.write(`void-fbtee: ${error.message}\n`);
  process.exitCode = 1;
});
