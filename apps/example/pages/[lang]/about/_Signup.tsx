// An island: hydrates on its own, with only its props. No layout, no Void router.
import { useState } from "react";
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";

export default function Signup({ seats }: { seats: number }) {
  const { locale } = useLocale();
  // void-fbtee's Link inside an island, where there is no Void router (a language switcher).
  const [count, setCount] = useState(seats);
  return (
    <section data-testid="signup">
      <p data-testid="signup-text">
        <fbt desc="Seats left, island">
          <fbt:plural count={count} showCount="yes" many="seats left">
            seat left
          </fbt:plural>
        </fbt>
      </p>
      <p data-testid="signup-number">{new Intl.NumberFormat(locale).format(count * 1234.5)}</p>
      <button
        data-testid="signup-take"
        type="button"
        onClick={() => setCount((n) => Math.max(0, n - 1))}
      >
        <fbt desc="Button that takes one seat">Take a seat</fbt>
      </button>
      <Link href="/de-DE/about" data-testid="signup-to-de">
        Deutsch
      </Link>{" "}
      <Link href={`/${locale}/blog`} data-testid="signup-to-blog">
        Blog
      </Link>
    </section>
  );
}
