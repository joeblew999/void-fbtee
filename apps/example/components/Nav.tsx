// The example's navigation: its pages, and this page in every language, each named in its own
// language (Intl.DisplayNames). Plain links, so crawlers find every language version; void-fbtee's
// Link loads a fresh page for another language.
import { fbt } from "fbtee";
import { Link, useLocale, useLocales } from "void-fbtee/react";

export type Page = "" | "/formats" | "/about" | "/docs";

export default function Nav({ page }: { page: Page }) {
  const { locale } = useLocale();
  const locales = useLocales();
  const to = (p: Page, l = locale) => `/${l}${p}` as never;
  return (
    <nav className="nav">
      <Link href={to("")} data-testid="nav-home">
        <fbt desc="Navigation: the home page">Home</fbt>
      </Link>
      <Link href={to("/formats")} data-testid="nav-formats">
        <fbt desc="Navigation: the page that shows every Intl format">Formats</fbt>
      </Link>
      <Link href={to("/about")} data-testid="nav-about">
        <fbt desc="Navigation: the page made of islands">Islands</fbt>
      </Link>
      <Link href={to("/docs")} data-testid="nav-docs">
        <fbt desc="Navigation: the documentation">Docs</fbt>
      </Link>
      <span className="languages">
        {locales.map((l) => (
          <Link
            key={l.locale}
            href={to(page, l.segment)}
            hrefLang={l.locale}
            lang={l.locale}
            data-testid={`to-${l.locale}`}
          >
            {new Intl.DisplayNames(l.locale, { type: "language" }).of(
              new Intl.Locale(l.locale).language,
            )}
          </Link>
        ))}
      </span>
    </nav>
  );
}
