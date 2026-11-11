// The example's navigation: its pages, and this page in every language, each named in its own
// language (Intl.DisplayNames). Plain links, so crawlers find every language version; void-fbtee's
// Link loads a fresh page for another language. Styled as shadcn buttons.
import { fbt } from "fbtee";
import { Link, useLocale, useLocales } from "void-fbtee/react";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type Page = "" | "/formats" | "/about" | "/docs";

export default function Nav({ page }: { page: Page }) {
  const { locale } = useLocale();
  const locales = useLocales();
  const to = (p: Page, l = locale) => `/${l}${p}` as never;
  const item = buttonVariants({ variant: "ghost", size: "sm" });
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1">
      <Link href={to("")} className={item} data-testid="nav-home">
        <fbt desc="Navigation: the home page">Home</fbt>
      </Link>
      <Link href={to("/formats")} className={item} data-testid="nav-formats">
        <fbt desc="Navigation: the page that shows every Intl format">Formats</fbt>
      </Link>
      <Link href={to("/about")} className={item} data-testid="nav-about">
        <fbt desc="Navigation: the page made of islands">Islands</fbt>
      </Link>
      <Link href={to("/docs")} className={item} data-testid="nav-docs">
        <fbt desc="Navigation: the documentation">Docs</fbt>
      </Link>
      <Separator orientation="vertical" className="mx-2 h-5" />
      <span className="ms-auto flex gap-1">
        {locales.map((l) => (
          <Link
            key={l.locale}
            href={to(page, l.segment)}
            hrefLang={l.locale}
            lang={l.locale}
            className={buttonVariants({
              variant: l.locale === locale ? "secondary" : "ghost",
              size: "sm",
            })}
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
