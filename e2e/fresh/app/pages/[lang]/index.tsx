// The fresh-install check's page: void-fbtee alone in a plain `void init` app (no shadcn), using
// strings the example translates, so the example's catalogs apply. Its loader and head are Void's
// docs examples (index.server.ts).
import { fbt } from "fbtee";
import type { Props } from "./index.server";

export default function Home({ locale }: Props) {
  return (
    <main>
      <h1 data-testid="title">
        <fbt desc="Home page heading">i18n for Void apps</fbt>
      </h1>
      <p data-testid="loader-locale">{locale}</p>
    </main>
  );
}
