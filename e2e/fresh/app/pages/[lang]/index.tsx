// The fresh-install check's pages: void-fbtee alone in a plain `void init` app (no shadcn), using
// strings the example translates, so the example's catalogs apply.
import { fbt } from "fbtee";

export default function Home() {
  return (
    <main>
      <h1 data-testid="title">
        <fbt desc="Home page heading">i18n for Void apps</fbt>
      </h1>
    </main>
  );
}
