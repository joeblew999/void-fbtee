import { Suspense, use } from "react";
import { fbt } from "fbtee";
import type { Props } from "./index.server";

function Slow({ late }: { late: Props["late"] }) {
  const { count } = use(late);
  return (
    <p data-testid="deferred">
      <fbt desc="Text rendered from deferred loader data">
        Deferred:{" "}
        <fbt:plural count={count} many="nights" showCount="yes">
          night
        </fbt:plural>{" "}
        left
      </fbt>
    </p>
  );
}

export default function LangPage({ count, late }: Props) {
  return (
    <main>
      <h1 data-testid="title">
        <fbt desc="Page title of the i18n spike">Hello world</fbt>
      </h1>
      <p data-testid="plural">
        <fbt desc="How many nights are booked">
          You booked{" "}
          <fbt:plural count={count} many="nights" showCount="yes">
            night
          </fbt:plural>
        </fbt>
      </p>
      <Suspense fallback={<p>…</p>}>
        <Slow late={late} />
      </Suspense>
    </main>
  );
}
