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
- `apps/example`: a Void app using it, in five languages
- `e2e/`: the browser tests and the fresh-install check

The scripts are in `package.json`. `pnpm run ci` is what CI runs.

## License

MIT
