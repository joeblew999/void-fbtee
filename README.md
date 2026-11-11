# void-fbtee

i18n for [Void](https://void.cloud) apps: translated strings with [fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, and numbers, lists and relative time from the browser's own `Intl`. It also has a built-in AI translation step.

It works the Void way: a Vite plugin, a Void middleware and a layout provider. It runs on Vite+ and on plain Vite, with islands and markdown pages too.

## Add it to a Void app

It isn't on npm. An app installs it straight from this GitHub repo, with pnpm.

In the app's `package.json`:

```json
"dependencies": {
  "void-fbtee": "github:joeblew999/void-fbtee#path:/packages/void-fbtee"
}
```

In the app's `pnpm-workspace.yaml` (pnpm only builds a git dependency you allow):

```yaml
allowBuilds:
  "void-fbtee@git+https://github.com/joeblew999/void-fbtee.git": true
```

Then:

```sh
pnpm install
pnpm exec void-fbtee init --locales ar-EG,th-TH
pnpm install
pnpm run i18n:translate
```

`init` wires everything in and only adds what's missing. `void-fbtee --help` lists the commands.

## This repo

- `packages/void-fbtee`: the package
- `apps/example`: a Void app using it, in three languages, live at https://void-fbtee-example.gedw99.workers.dev
- `e2e/`: the browser tests and the fresh-install check

It runs on [Vite+](https://viteplus.dev). Install its `vp` command once per machine
([guide](https://viteplus.dev/guide/global-cli)); it brings the Node in `.node-version` and the
pnpm in `package.json`. Then:

```sh
vp install
vp run install:browser   # Chromium for the browser tests, once
vp check                 # format, lint, types
vp test run              # every test
```

CI runs those same commands. The repo's tasks are in `vite.config.ts` and
`apps/example/vite.config.ts`; `vp run` lists them. Changes to the package reach the example by
themselves: `vp run dev` rebuilds the package on save, and the example's `build` and `deploy`
rebuild it first.

To deploy the example to Cloudflare, `vp run deploy`. The first time on a machine it asks you to
sign in (`vp run login` does only that).

In a Claude cloud session, `.claude/hooks/cloud-session.sh` installs `vp` and a keyring for the
sign-in, so Claude runs the same commands. A new session needs one sign-in: Claude runs
`vp run login` (inside `script`, as void's sign-in wants a terminal), which prints Cloudflare's link, and you click Allow.

## License

MIT
