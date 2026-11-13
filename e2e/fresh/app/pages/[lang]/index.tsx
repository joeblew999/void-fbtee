// The fresh-install check's page: void-fbtee alone in a plain `void init` app (no shadcn), using
// strings the example translates, so the example's catalogs apply. Its loader and head are Void's
// docs examples (index.server.ts); its link is built with no language given (void-fbtee/routes).
import { fbt } from "fbtee";
import { routeUrl } from "void-fbtee/routes";
import type { Props } from "./index.server";

export default function Home({ locale }: Props) {
  return (
    <main>
      <h1 data-testid="title">
        <fbt desc="Home page heading">i18n for Void apps</fbt>
      </h1>
      <p data-testid="loader-locale">{locale}</p>
      <a href={routeUrl("/[lang]/form")} data-testid="form-link">
        <fbt desc="Home page heading">i18n for Void apps</fbt>
      </a>
    </main>
  );
}
