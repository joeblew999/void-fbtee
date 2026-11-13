// The site's look for its emails, straight from pages/style.css: the `@theme inline` entries
// (colours, radius, font), their var()s filled from the `.dark` palette the site always uses, under
// the site's own names, for React Email's <Tailwind> (react.email/docs/components/tailwind). React
// Email turns them into what mail apps understand (oklch into rgb, the calc()s worked out, inline
// styles); its pixelBasedPreset writes Tailwind's sizes in px, which more mail apps read than rem.
// So the emails name tokens (`bg-card`, `text-brand`), never colours, and a change to style.css is
// a change to the emails. Read as text with Vite's `?raw`: in dev and the Worker build as Vite does
// it; in the unit tests through `test.css` in vite.config.ts (Vitest leaves CSS out otherwise).
import { pixelBasedPreset, type TailwindConfig } from "react-email";
import css from "../../pages/style.css?raw";

/** A CSS block's custom properties, by name without the `--`. */
function block(selector: RegExp): Record<string, string> {
  const body = selector.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const palette = block(/\.dark\s*\{([^}]*)\}/);
const theme = block(/@theme inline\s*\{([^}]*)\}/);

/** A value with its var()s filled from the palette, or from the theme itself (`--font-heading`). */
function fill(value: string): string {
  return value.replace(/var\(--([\w-]+)\)/g, (whole, name: string) => {
    const found = palette[name] ?? theme[name];
    return found === undefined ? whole : fill(found);
  });
}

/** The theme's entries that start with `prefix`, without it, filled. */
const entries = (prefix: string) =>
  Object.fromEntries(
    Object.entries(theme)
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, value]) => [name.slice(prefix.length), fill(value)]),
  );

export const emailTheme: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: entries("color-"),
      borderRadius: entries("radius-"),
      fontFamily: Object.fromEntries(
        Object.entries(entries("font-")).map(([name, fonts]) => [
          name,
          fonts.split(",").map((font) => font.trim()),
        ]),
      ),
    },
  },
};
