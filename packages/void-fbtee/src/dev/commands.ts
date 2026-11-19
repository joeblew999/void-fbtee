// Reading the app's project from its config, and preparing its catalogs (the dev server does).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { loadConfigFromFile } from "vite";
import { catalogFile, prepared, type Project } from "./catalogs";
import { runner } from "./translate";
import type { VoidFbteeApi } from "./plugin";
import { field, isRecord } from "../guards";

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
  const given: unknown[] = loaded?.config.plugins ?? [];
  const api = given
    .flat(Infinity)
    .map((p) => field(p, "api"))
    .find(
      (a): a is VoidFbteeApi =>
        isRecord(a) && typeof a.project === "function" && isRecord(a.options),
    );
  if (!api)
    throw new Error(
      `void-fbtee: no voidFbtee() plugin in ${relative(process.cwd(), loaded?.path ?? root) || "vite.config.ts"}. Run \`${runner(root)} exec void-fbtee init\` first.`,
    );
  return { ...api.project(), root: loaded?.config.root ? resolve(root, loaded.config.root) : root };
}

export function prepare(p: Project): string[] {
  const written: string[] = [];
  for (const { locale, json } of prepared(p)) {
    const file = catalogFile(p, locale);
    // fbtee's CLI writes catalogs with two-space indentation and a final newline; so do we.
    const text = JSON.stringify(JSON.parse(json), null, 2) + "\n";
    // Only a catalog that changed is written: the dev server prepares on every save
    // (plugin.ts), and an unchanged file left alone is no reload and no diff.
    if (existsSync(file) && readFileSync(file, "utf8") === text) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    written.push(relative(p.root, file));
  }
  return written;
}
