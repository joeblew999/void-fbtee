# void-fbtee

i18n for [Void](https://void.cloud) apps: strings translated with
[fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, numbers and lists with
the platform's own `Intl`. An example app in three languages:
https://void-fbtee-example.gedw99.workers.dev

## What it is

A Void add-on, built the way Void's own `@void/md` and `@void/react` are: a Vite plugin
(`import { voidFbtee } from "void-fbtee/plugin"`) plus the parts a Void app uses at run time
(`void-fbtee/middleware`, `void-fbtee/react`). The Vite plugin works only in a Void app: it swaps
modules in Void's server environment (Cloudflare's own Temporal, fbtee's per-request build, Void's
own Hono), and the rest goes where Void looks for it (`middleware/99.i18n.ts`, `void.config.ts`),
which `void-fbtee init` sets up and `void-fbtee check` checks. React only, as fbtee is. It works
with Vite+ and with plain Vite, and with npm and pnpm.

The rule it follows is the one for dates in a database: data stays neutral (UTC instants with zone
names, plain numbers with currency codes), both to the browser and back, and is formatted once,
for the screen. The server formats a page's text and the browser keeps it (`<Formatted>`), because
each browser engine ships its own locale data and writes some values differently. What only the
browser knows, such as the reader's own time zone, the browser formats, once it knows it: the
server leaves that space empty rather than showing a stand-in.

## Add it to a Void app

It isn't on npm yet: an app installs a
[release](https://github.com/joeblew999/void-fbtee/releases) from its repo. In the app's
`package.json`:

```json
"dependencies": {
  "void-fbtee": "github:joeblew999/void-fbtee#v0.3.0&path:/packages/void-fbtee"
}
```

With pnpm, in its `pnpm-workspace.yaml` (pnpm only builds a git dependency you allow):

```yaml
allowBuilds:
  "void-fbtee@git+https://github.com/joeblew999/void-fbtee.git": true
```

Then, in the app's folder:

```sh
vp install
vp exec void-fbtee init --locales ar-EG,th-TH
vp install
vp run i18n:translate
```

`init` adds only what's missing, so it's safe to run again. `void-fbtee check` lists anything
untranslated or not set up, and `void-fbtee --help` lists the commands.

## Using it

How to write translated strings, format dates and numbers in components, build typed links, give
pages translated titles and translate markdown pages: `skills/void-fbtee/SKILL.md` in this
package. It's written for coding agents, and `init` links it where yours finds it.

## Systems

fbtee's compiler is native code, installed already built for your system by your package
manager. fbtee builds it for macOS (Apple Silicon and Intel), Windows (x64 and ARM) and Linux
(x64 and ARM, glibc and musl).

On Vite+, `init` adds fbtee's lint rules (`@nkzw/eslint-plugin-fbtee`). They use typescript-eslint,
which doesn't support TypeScript 7 yet ([typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518)),
so your package manager warns of an unmet `typescript` peer. The rules work. With pnpm's
`strictPeerDependencies`, allow it in `pnpm-workspace.yaml`:

```yaml
peerDependencyRules:
  allowedVersions:
    "@typescript-eslint/utils>typescript": "7"
    "@typescript-eslint/typescript-estree>typescript": "7"
    "@typescript-eslint/project-service>typescript": "7"
    "@typescript-eslint/tsconfig-utils>typescript": "7"
```

## License

MIT
