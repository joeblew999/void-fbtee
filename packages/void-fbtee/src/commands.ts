// The void-fbtee command's commands, as functions (the CLI in cli.ts runs them; tests call them).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { resolveConfig } from "vite";
import { catalogFile, prepared, type Project } from "./catalogs";
import type { VoidFbteeApi } from "./vite";

/** The app as the void-fbtee plugin in its vite.config.ts sees it. */
export async function loadProject(root: string): Promise<Project> {
  const config = await resolveConfig({ root, logLevel: "silent" }, "build");
  const plugin = config.plugins.find((p) => p.name === "void-fbtee");
  const api = plugin?.api as VoidFbteeApi | undefined;
  if (!api)
    throw new Error(
      `void-fbtee: no voidFbtee() plugin in ${relative(process.cwd(), config.configFile ?? root) || "vite.config.ts"}. Run \`void-fbtee init\` first.`,
    );
  return api.project();
}

export function prepare(p: Project): string[] {
  const written: string[] = [];
  for (const { locale, json } of prepared(p)) {
    const file = catalogFile(p, locale);
    mkdirSync(dirname(file), { recursive: true });
    // fbtee's CLI writes catalogs with two-space indentation and a final newline; so do we.
    writeFileSync(file, JSON.stringify(JSON.parse(json), null, 2) + "\n");
    written.push(relative(p.root, file));
  }
  return written;
}
