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
// useLocale and <fbt> still work there; see install.ts and client.ts.
//
// Formatting: use JavaScript's Intl with useLocale().locale, as fbtee's README says ("Formatting
// Numbers and Dates"), and fbtee's list() for lists inside strings. Data stays neutral (UTC
// instants with zone names, plain numbers with currency codes); text formatted while rendering
// goes in <Formatted>, so it's formatted once for the screen: by the server, kept by the browser.
import {
  use,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
  type ComponentProps,
} from "react";
import { Link as VoidLink, SharedContext, useForm as voidUseForm } from "@void/react";
import type { ActionUrl, ResolveActionBody, ResolveActionParams } from "void/routes";
import {
  createFbteeRuntime,
  LocaleProvider,
  type FbteeRuntime,
  type Gender,
  type TranslationDictionary,
} from "fbtee";
import catalogs from "virtual:void-fbtee/catalogs";
import { Temporal } from "temporal-polyfill";
import config from "virtual:void-fbtee/config";
import { currentTranslations } from "./current";
import { langAttrs, localeFromPath, type Lang, type Locale } from "./locales";
import { allTranslations } from "./runtime";
export { langAttrs } from "./locales";
import { install, documentI18n } from "./install";
import type { SharedI18n } from "./middleware";

/**
 * Text formatted while rendering (Intl, or Temporal's toLocaleString), in a <span>. The server
 * formats it first. Each browser engine ships its own locale data and can write the same value
 * differently (Safari's WebKit against V8, which Chrome and the Worker share), which would break
 * hydration (React error 418). So the browser keeps the server's text, and React only replaces it
 * when the value itself changes, such as a time "in your time" once the browser knows the zone.
 * It works one level deep (React's suppressHydrationWarning): the text must be the span's child.
 */
export function Formatted({
  children,
  ...props
}: Omit<ComponentProps<"span">, "children" | "suppressHydrationWarning"> & {
  children: string | number;
}) {
  return (
    <span {...props} suppressHydrationWarning>
      {children}
    </span>
  );
}

/**
 * False on the server and while hydrating, true after: for what only the browser can work out
 * (its own engine's formatting, its clock, its zone), so the first render matches the server's.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

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

/** Every locale the app serves, as configured in voidFbtee(): for a list of language links. */
export function useLocales(): Locale[] {
  return config.locales;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  if (!import.meta.env.SSR) use(install(locale) as Promise<void>);
  return children;
}

/**
 * Part of a page in another language, by fbtee's scoped runtimes (its README, "Scoped Runtimes"):
 * a row for a Thai reader on an English page, a caption in the watcher's language. Inside it,
 * components that translate call fbtee's `useFbt()` and keep its local names, so their <fbt> and
 * fbs are in `locale`: `const { fbt } = useFbt();`. Plain <fbt> elsewhere stays in the page's
 * language, as fbtee's global imports do. `gender` is the reader's, for sentences that address
 * them (`<fbt:pronoun>`, viewer gender), and only when the person gave it.
 *
 * It takes only the locale: the runtime carries functions, so it can't cross from the server to the
 * browser (fbtee's README: "pass locale and translation data across that boundary"). The server
 * builds it from the request's catalogs at once; the browser loads them first, keeping the
 * server's HTML meanwhile. The element carries `lang` and `dir`.
 */
export function InLanguage({
  locale,
  gender,
  children,
}: {
  locale: string;
  gender?: Gender;
  children: ReactNode;
}) {
  const runtime = import.meta.env.SSR
    ? serverRuntime(locale, gender)
    : use(browserRuntime(locale, gender));
  return (
    <LocaleProvider runtime={runtime}>
      <span {...langAttrs(locale)}>{children}</span>
    </LocaleProvider>
  );
}

const runtimeOptions = (
  locale: string,
  gender: Gender | undefined,
  translations: TranslationDictionary,
) => ({
  locale,
  gender,
  translations,
  sourceLocale: config.sourceLocale,
  fallbackLocales: config.fallbackLocales,
});

// One runtime per request's catalogs, language and gender, on the server.
const serverRuntimes = new WeakMap<TranslationDictionary, Map<string, FbteeRuntime>>();
function serverRuntime(locale: string, gender: Gender | undefined): FbteeRuntime {
  const translations = currentTranslations() ?? {};
  let byKey = serverRuntimes.get(translations);
  if (!byKey) serverRuntimes.set(translations, (byKey = new Map()));
  const key = `${locale} ${gender ?? ""}`;
  let runtime = byKey.get(key);
  if (!runtime)
    byKey.set(key, (runtime = createFbteeRuntime(runtimeOptions(locale, gender, translations))));
  return runtime;
}

// One per language and gender in the browser, made once every catalog has loaded.
const browserRuntimes = new Map<string, Promise<FbteeRuntime>>();
function browserRuntime(locale: string, gender: Gender | undefined): Promise<FbteeRuntime> {
  const key = `${locale} ${gender ?? ""}`;
  let runtime = browserRuntimes.get(key);
  if (!runtime) {
    runtime = allTranslations(catalogs).then((t) =>
      createFbteeRuntime(runtimeOptions(locale, gender, t)),
    );
    browserRuntimes.set(key, runtime);
  }
  return runtime;
}

/**
 * Void's Link, but a link into another language loads a fresh page: Void's client navigation
 * would keep the old language's text and <html lang dir>. It also works
 * inside an island, where there is no Void router: a click is then a normal page load.
 */
export function Link(props: ComponentProps<typeof VoidLink>) {
  const { locale } = useLocale();
  const href = typeof props.href === "string" ? props.href : "";
  const target = href.startsWith("/") ? localeFromPath(href, config) : undefined;
  const crossesLocale = target !== undefined && target.locale !== locale;
  return <VoidLink {...props} reloadDocument={props.reloadDocument ?? crossesLocale} />;
}

// An action's URL, as Void's useForm takes it. In this package Void's route types are its empty
// stubs (ActionUrl is never; in an app, its routes), which the lint reads as redundant.
// oxlint-disable-next-line no-redundant-type-constituents
type FormUrl = ActionUrl & string;

type VoidFormOptions<U extends FormUrl> = NonNullable<Parameters<typeof voidUseForm<U>>[2]>;
type ActionParams<U extends FormUrl> = ResolveActionParams<U> & Record<string, string>;

/** Void's form options, with `lang` optional among the params. */
export type LangFormOptions<U extends FormUrl> = Omit<VoidFormOptions<U>, "params"> &
  ("lang" extends keyof ActionParams<U>
    ? [Exclude<keyof ActionParams<U>, "lang">] extends [never]
      ? { params?: { lang?: Lang } }
      : { params: Omit<ActionParams<U>, "lang"> & { lang?: Lang } }
    : Pick<VoidFormOptions<U>, "params">);

/**
 * Void's useForm (@void/react), with the page's language filled in: a page under `pages/[lang]/`
 * posts to its own action in the language it's shown in, so `useForm("/[lang]/events/new", { … })`
 * needs no `params.lang` (other params, such as an id, still do). Typed from the action as Void's is.
 */
export function useForm<U extends FormUrl>(
  url: U,
  defaults: ResolveActionBody<U>,
  options?: LangFormOptions<U>,
): ReturnType<typeof voidUseForm<U>> {
  const { lang } = useLocale();
  const given = options as { params?: Record<string, string> } | undefined;
  const params = String(url).includes("[lang]")
    ? { ...given?.params, lang: given?.params?.lang ?? lang }
    : given?.params;
  return voidUseForm(url, defaults, { ...options, params } as VoidFormOptions<U>);
}

/**
 * "Now" that stays right on cached pages. The first render uses the server's "now", so it hydrates
 * with the same text; then it switches to the browser's clock. Use it for anything relative to
 * now: a page from Void's page cache was rendered long before it's read, so the server's "now" in
 * it is old. With `updateInterval` (milliseconds) it reads the clock again that often, so a page
 * left open moves on ("tomorrow" becomes "today" after midnight), as next-intl's useNow does;
 * without it, the clock is read once.
 */
export function useNow(options?: { updateInterval?: number }): Temporal.Instant {
  const { now } = useLocale();
  const interval = options?.updateInterval;
  const subscribe = useCallback(
    (changed: () => void) => {
      if (!interval) return () => {};
      const timer = setInterval(() => {
        browserInstant = Temporal.Now.instant();
        changed();
      }, interval);
      return () => clearInterval(timer);
    },
    [interval],
  );
  // React renders getServerSnapshot while hydrating, then re-renders with getSnapshot.
  return useSyncExternalStore(subscribe, browserNow, () => serverNow(now));
}

/**
 * The reader's time zone, for times shown "in your time", or null while it isn't known. Only the
 * browser knows it (the device's own setting, through Intl), so it's null on the server and while
 * hydrating, then the browser's zone: render nothing for such a time until then (keep its space),
 * so no stand-in time is ever shown. A time that belongs to a place carries its own zone instead
 * (a ZonedDateTime) and needs none of this.
 */
export function useTimeZone(): string | null {
  return useSyncExternalStore(noSubscribe, browserZone, () => null);
}

let zone: string | undefined;
const browserZone = () => (zone ??= new Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");

const noSubscribe = () => () => {};
let browserInstant: Temporal.Instant | undefined;
const browserNow = () => (browserInstant ??= Temporal.Now.instant());
const serverInstants = new Map<string, Temporal.Instant>();
const serverNow = (iso: string) => {
  let instant = serverInstants.get(iso);
  if (!instant) serverInstants.set(iso, (instant = Temporal.Instant.from(iso)));
  return instant;
};
