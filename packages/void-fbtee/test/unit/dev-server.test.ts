// The plugin on a real Vite dev server (Vite's createServer, the fixture app), for two bugs nothing
// else would show, both found 2026-11-20 (plans/2026-11-20-01-plugin-conformance.md):
// - after Vite closes the dev server (on quit, and on every restart after a config change), the
//   plugin went on: catalogs were rewritten 156 ms after the close. Now closeServer stops it.
// - a translated page saved in place in two steps (the file emptied, then written: some editors
//   save so) was read empty, so a page marked done was never recorded (0 of 30 saves). Now the
//   page is read through Vite's hotUpdate `read()`, which waits for the write (30 of 30).
// Under Vitest the plugin starts no translator, so only its own writes are seen.
import {
  closeSync,
  mkdirSync,
  openSync,
  appendFileSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { voidFbtee } from "../../src/dev/plugin";
import { copyFixture } from "./copy-fixture";

const options = { sourceLocale: "en-US", locales: ["en-US", "de-DE"], src: ["src/**/*.tsx"] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let root = "";
let server: ViteDevServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  rmSync(root, { recursive: true, force: true });
});

/** Each catalog's last write time. */
const times = (dir: string) => {
  const catalogs = join(dir, "i18n/translations");
  return Object.fromEntries(
    readdirSync(catalogs).map((f) => [f, statSync(join(catalogs, f)).mtimeMs]),
  );
};

/** The dev server started, and done with what it does as it starts (each language's catalog):
 * the catalogs unchanged for half a second. */
async function start(dir: string) {
  server = await createServer({
    root: dir,
    configFile: false,
    logLevel: "silent",
    plugins: voidFbtee(options),
    server: { port: 0 },
  });
  await server.listen();
  let last = JSON.stringify(times(dir));
  for (let quiet = 0; quiet < 500;) {
    await sleep(100);
    const now = JSON.stringify(times(dir));
    quiet = now === last ? quiet + 100 : 0;
    last = now;
  }
  return server;
}

test("once the dev server has closed, the plugin writes nothing more", async () => {
  root = copyFixture();
  const dev = await start(root);
  const before = times(root);
  // A new string, saved: the catalogs are due to be rewritten shortly after.
  appendFileSync(
    join(root, "src/main.tsx"),
    `\nexport const added = () => <fbt desc="Added by the test">A brand new string</fbt>;\n`,
  );
  await sleep(150);
  await dev.close();
  server = undefined;
  await sleep(2000);
  expect(times(root)).toEqual(before);
});

test("a translated page saved in place, in two steps, is recorded", async () => {
  root = copyFixture();
  mkdirSync(join(root, "pages/en-US"), { recursive: true });
  mkdirSync(join(root, "pages/de-DE"), { recursive: true });
  // About 60 KB, as a real page can be, so the write takes long enough to be caught half-done.
  writeFileSync(
    join(root, "pages/en-US/hello.md"),
    `---\ntitle: Hello\n---\n\n${"A sentence. ".repeat(5000)}\n`,
  );
  const page = join(root, "pages/de-DE/hello.md");
  writeFileSync(page, "---\ntitle: Hallo\n---\n\nNoch nicht übersetzt.\n");
  await start(root);
  // The agent's finished page, marked done, saved in place: emptied, then written.
  const fd = openSync(page, "w");
  await sleep(5);
  writeSync(fd, `---\ntitle: Hallo\ntranslatedFrom: done\n---\n\n${"Ein Satz. ".repeat(5000)}\n`);
  closeSync(fd);
  await vi.waitFor(
    () => expect(readFileSync(page, "utf8")).toMatch(/translatedFrom: "[0-9a-f]{12}"/),
    { timeout: 3000, interval: 100 },
  );
});
