// React side of void-fbtee.
//
// I18nProvider goes in the app's root layout (pages/layout.tsx): <fbt> runs during each page's
// own render, so the provider must sit above every page. On the server it renders children as-is
// (the middleware holds fbtee's per-request state). In the browser it suspends until the page's
// catalog is loaded, then installs it before any <fbt> renders; hydration runs in a transition,
// so the server HTML stays on screen meanwhile. (The plugin's client setup usually has the catalog
// installed before the page's modules even run; then this returns at once.)
//
// Islands (.island.tsx pages, and .md pages) hydrate each island on its own, without the layout.
// useLocale/useIntl and <fbt> still work there; see install.ts and client.ts.
import { use, useContext, useSyncExternalStore, type ReactNode, type ComponentProps } from "react";
import { Link as VoidLink, SharedContext } from "@void/react";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import { localeFromPath } from "./locales";
import { install, documentI18n } from "./install";
import type { SharedI18n } from "./middleware";

/** The page's locale, direction and the server's "now", as the middleware set them. */
export function useLocale(): SharedI18n {
  // Regular pages, and islands while the server renders them, have Void's shared data. An island
  // hydrating in the browser has only its props, so it reads the middleware's <meta> instead.
  const shared = useContext(SharedContext) as { i18n?: SharedI18n } | null;
  const i18n = shared?.i18n ?? documentI18n();
  if (!i18n)
    throw new Error("void-fbtee: shared.i18n is missing. Is middleware/99.i18n.ts set up?");
  return i18n;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  if (!import.meta.env.SSR) use(install(locale) as Promise<void>);
  return children;
}

/**
 * Void's Link, but a link into another language loads a fresh page: Void's client navigation
 * would keep the old language's text and <html lang dir> (plan #1, check 8). It also works
 * inside an island, where there is no Void router: a click is then a normal page load.
 */
export function Link(props: ComponentProps<typeof VoidLink>) {
  const { locale } = useLocale();
  const href = typeof props.href === "string" ? props.href : "";
  const target = href.startsWith("/") ? localeFromPath(href, config) : undefined;
  const crossesLocale = target !== undefined && target.locale !== locale;
  return <VoidLink {...props} reloadDocument={props.reloadDocument ?? crossesLocale} />;
}

/**
 * "Now" that stays right on cached pages. The first render uses the server's "now", so it hydrates
 * with the same text; then it switches to the browser's clock. Use it for anything relative to
 * now on prerendered pages: Void prerenders markdown pages and loader-free island pages at
 * deploy and caches them, so the server's "now" there is the deploy time.
 */
export function useNow(): Temporal.Instant {
  const { now } = useLocale();
  // React renders getServerSnapshot while hydrating, then re-renders with getSnapshot.
  return useSyncExternalStore(noSubscribe, browserNow, () => serverNow(now));
}

const noSubscribe = () => () => {};
let browserInstant: Temporal.Instant | undefined;
const browserNow = () => (browserInstant ??= Temporal.Now.instant());
const serverInstants = new Map<string, Temporal.Instant>();
const serverNow = (iso: string) => {
  let instant = serverInstants.get(iso);
  if (!instant) serverInstants.set(iso, (instant = Temporal.Instant.from(iso)));
  return instant;
};

type Formattable =
  | Temporal.ZonedDateTime
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.PlainTime
  | Temporal.PlainYearMonth
  | Temporal.PlainMonthDay;

/**
 * Formatting for the page's locale. Same text on the server and in the browser:
 * - times carry their own time zone (a ZonedDateTime), never the viewer's or the server's;
 * - "now" is the server's, from the middleware;
 * - Temporal values format with their own toLocaleString (the polyfill doesn't patch Intl).
 */
export function useIntl() {
  const { locale, now } = useLocale();
  const nowInstant = Temporal.Instant.from(now);
  return {
    locale,
    /** The server's "now" for this response. */
    now: nowInstant,
    date: (value: Formattable, options?: Intl.DateTimeFormatOptions) =>
      value.toLocaleString(locale, options),
    number: (value: number | bigint, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    list: (items: string[], options?: Intl.ListFormatOptions) =>
      new Intl.ListFormat(locale, options).format(items),
    duration: (value: Temporal.Duration | string, options?: Intl.DurationFormatOptions) =>
      new Intl.DurationFormat(locale, options).format(
        typeof value === "string" ? Temporal.Duration.from(value) : value,
      ),
    /**
     * "tomorrow", "in 44 days": calendar days from now to a time, in that time's own zone.
     * `from` defaults to the server's "now"; pass useNow() on prerendered pages.
     */
    relativeDays: (
      to: Temporal.ZonedDateTime,
      options?: Intl.RelativeTimeFormatOptions,
      from: Temporal.Instant = nowInstant,
    ) => {
      const today = from.toZonedDateTimeISO(to.timeZoneId).toPlainDate();
      const days = today.until(to.toPlainDate()).days;
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto", ...options }).format(
        days,
        "day",
      );
    },
  };
}
