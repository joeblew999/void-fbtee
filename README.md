# void-fbtee

i18n for [Void](https://void.cloud) apps: translated strings with [fbtee](https://github.com/nkzw-tech/fbtee), dates and times with Temporal, and numbers, lists and relative time from the browser's own `Intl`. It also has a built-in AI translation step.

It works the Void way: a Vite plugin, a Void middleware and a layout provider. It runs on Vite+ and on plain Vite, with islands and markdown pages too.

## Add it to a Void app

Not on npm yet. Once it is, in an app made with `void init`:

```sh
npx void-fbtee init --locales th-TH,de-DE
```

`init` wires everything in and only adds what's missing. Then install, and translate:

```sh
npm install
npm run i18n:translate
```

`void-fbtee --help` lists the commands.

## This repo

- `packages/void-fbtee`: the package
- `apps/example`: a Void app using it, in five languages
- `e2e/`: the browser tests and the fresh-install check

The scripts are in `package.json`. `pnpm run ci` is what CI runs.

## License

MIT
