import { Suspense, use, useState } from "react";
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";

// Suspends during SSR (not a Void defer), so it renders after the shell,
// i.e. after the middleware's `await next()` has already returned.
const waits = new Map<string, Promise<void>>();
function ServerSlow({ id }: { id: string }) {
  let p = waits.get(id);
  if (!p) waits.set(id, (p = new Promise((r) => setTimeout(r, 400))));
  use(p);
  return (
    <p data-testid="streamed">
      <fbt desc="Text rendered in a server Suspense boundary after the shell">
        Streamed after the shell
      </fbt>
    </p>
  );
}

export default function StreamPage() {
  // One wait per request, so concurrent requests really overlap after the shell.
  const [id] = useState(() => crypto.randomUUID());
  const { locale } = useLocale();
  return (
    <main>
      <Link href="/de-DE/stream" data-testid="to-de">
        Deutsch
      </Link>
      <Link href={`/${locale}/time`} data-testid="to-time">
        time
      </Link>
      <h1 data-testid="title">
        <fbt desc="Page title of the i18n spike">Hello world</fbt>
      </h1>
      <Suspense fallback={<p>…</p>}>
        <ServerSlow id={id} />
      </Suspense>
    </main>
  );
}
