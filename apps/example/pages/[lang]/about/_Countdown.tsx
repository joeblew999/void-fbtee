// An island that hydrates when visible: a Temporal date with its own zone. useNow() starts at the
// server's "now" (same text as the HTML) and moves to the browser's clock, so it stays right even
// if the page was prerendered and cached.
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { useIntl, useNow } from "void-fbtee/react";

export default function Countdown({ launch }: { launch: string }) {
  const intl = useIntl();
  const now = useNow();
  const at = Temporal.ZonedDateTime.from(launch);
  return (
    <p data-testid="countdown">
      <fbt desc="When the launch is, relative to today">
        Launch: <fbt:param name="when">{intl.relativeDays(at, undefined, now)}</fbt:param>
      </fbt>
    </p>
  );
}
