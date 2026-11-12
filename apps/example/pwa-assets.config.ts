// The site's icons, made from public/favicon.svg by @vite-pwa/assets-generator (`vp run icons`):
// its minimal-2023 preset (favicon.ico, 64/192/512 px, a 512 px maskable and a 180 px Apple icon),
// written into public/ beside the SVG and committed. Run it again when the SVG changes. Padded
// icons (maskable, Apple) get the icon's own violet behind them instead of the default white.
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

const violet = { background: "#8f81ff" };

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: violet },
    apple: { ...minimal2023Preset.apple, resizeOptions: violet },
  },
  images: ["public/favicon.svg"],
});
