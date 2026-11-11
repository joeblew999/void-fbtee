// The void-fbtee command's commands, as functions (the CLI in cli.ts runs them; tests call them).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { loadConfigFromFile } from "vite";
import { catalogFile, prepared, type Project } from "./catalogs";
import type { VoidFbteeApi } from "./vite";

/**
 * The app as the void-fbtee plugin in its vite.config.ts sees it. Vite only loads the config file
 * (loadConfigFromFile): no plugin runs its setup, so reading the project changes nothing in the
 * app. (resolveConfig in "build" mode ran Void's plugin, which clears the app's build output.)
 */
export async function loadProject(root: string): Promise<Project> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    undefined,
    root,
    "silent",
  );
  const plugins = ((loaded?.config.plugins ?? []) as unknown[]).flat(Infinity) as {
    name?: string;
    api?: VoidFbteeApi;
  }[];
  const api = plugins.find((p) => p?.name === "void-fbtee")?.api;
  if (!api)
    throw new Error(
      `void-fbtee: no voidFbtee() plugin in ${relative(process.cwd(), loaded?.path ?? root) || "vite.config.ts"}. Run \`void-fbtee init\` first.`,
    );
  return { ...api.project(), root: loaded?.config.root ? resolve(root, loaded.config.root) : root };
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
