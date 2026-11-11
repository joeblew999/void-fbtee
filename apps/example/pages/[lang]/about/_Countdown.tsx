// An island that hydrates when visible: a Temporal date with its own zone. useNow() starts at the
// server's "now" (same text as the HTML) and moves to the browser's clock, so it stays right even
// if the page was prerendered and cached.
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { useLocale, useNow } from "void-fbtee/react";
import { relativeDays } from "../../../lib/relative-days";

export default function Countdown({ launch }: { launch: string }) {
  const { locale } = useLocale();
  const now = useNow();
  const at = Temporal.ZonedDateTime.from(launch);
  return (
    <p className="text-lg" data-testid="countdown">
      <fbt desc="When the launch is, relative to today">
        Launch: <fbt:param name="when">{relativeDays(locale, at, now)}</fbt:param>
      </fbt>
    </p>
  );
}
