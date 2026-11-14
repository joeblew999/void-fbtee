// The Temporal page, a reference: date and time arithmetic with Temporal, each result a neutral
// value (src/docs/temporal.ts), run four ways: on the Worker (the loader) with Cloudflare's own
// Temporal and with the polyfill, and in the browser after hydration, with its own and with the
// polyfill. Neutral results must match everywhere, so a highlighted row is a real bug, and its
// columns say whose. The reference is Cloudflare's own Temporal: what the app runs on the Worker.
// Formatting is on the Intl page.
import { fbt } from "fbtee";
import { Badge } from "@/ui/badge";
import { ownTemporal, Polyfill, runTemporal, TEMPORAL_SECTIONS } from "@/docs/temporal";
import { temporalTitle } from "@/docs/temporal-titles";
import { RowsSection } from "@/docs/RowsSection";
import { useBrowserOnce } from "@/docs/useBrowserOnce";
import { DocsPage } from "@/docs/DocsPage";
import type { Props } from "./temporal.server";

type Rows = Record<string, string>;
interface BrowserRows {
  /** With the browser's own Temporal; null if it has none. */
  own: Rows | null;
  /** With temporal-polyfill, in the browser. */
  polyfill: Rows;
}

/** A badge: how many rows one Temporal got the same as the reference, or that there's none. */
function Tally({
  id,
  rows,
  same,
  total,
  none,
  children,
}: {
  id: string;
  rows: Rows | null;
  same: number;
  total: number;
  none: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Badge variant={rows && same === total ? "secondary" : "outline"} data-testid={id}>
      {rows ? children : none}
    </Badge>
  );
}

export default function TemporalPage({ worker }: Props) {
  const browser = useBrowserOnce("temporal", (): BrowserRows => {
    const own = ownTemporal();
    return { own: own ? runTemporal(own) : null, polyfill: runTemporal(Polyfill) };
  });
  // What the app runs on the Worker: Cloudflare's own Temporal (void-fbtee requires its flag).
  const reference = worker.own ?? worker.polyfill;
  const keys = Object.keys(reference);
  const count = (rows: Rows | null) =>
    rows ? keys.filter((k) => rows[k] === reference[k]).length : 0;
  const total = keys.length;
  // The four ways, in column order (undefined: the browser hasn't run yet; null: no Temporal of
  // its own there).
  const columns: { side: string; rows: Rows | null | undefined }[] = [
    { side: "worker", rows: worker.own },
    { side: "worker-polyfill", rows: worker.polyfill },
    { side: "own", rows: browser ? browser.own : undefined },
    { side: "polyfill", rows: browser ? browser.polyfill : undefined },
  ];
  return (
    <DocsPage
      testId="temporal-title"
      title="Temporal"
      intro={
        <fbt desc="Temporal page introduction">
          Temporal does the arithmetic on dates and times. Each result is a neutral value, not text
          for the screen, so it must come out the same everywhere. Each row ran on the Worker with
          Cloudflare's own Temporal, which this app uses there, and with the temporal-polyfill
          package, and again in your browser: with its own Temporal, and with the polyfill. A
          highlighted row is a real bug, and its columns show whose.
        </fbt>
      }
      header={
        <>
          <div className="flex min-h-6 flex-wrap gap-2">
            <Tally
              id="temporal-worker-polyfill"
              rows={worker.polyfill}
              same={count(worker.polyfill)}
              total={total}
              none={null}
            >
              <fbt desc="How many Temporal rows the polyfill on the Worker got the same as Cloudflare's own Temporal">
                The polyfill on the Worker:{" "}
                <fbt:param name="same">{count(worker.polyfill)}</fbt:param> of{" "}
                <fbt:param name="total" number={total}>
                  {total}
                </fbt:param>{" "}
                the same.
              </fbt>
            </Tally>
            {browser && (
              <>
                <Tally
                  id="temporal-own"
                  rows={browser.own}
                  same={count(browser.own)}
                  total={total}
                  none={
                    <fbt desc="The visitor's browser has no Temporal of its own">
                      Your browser has no Temporal of its own.
                    </fbt>
                  }
                >
                  <fbt desc="How many Temporal rows the browser's own Temporal got the same as the Worker">
                    Your browser's own Temporal:{" "}
                    <fbt:param name="same">{count(browser.own)}</fbt:param> of{" "}
                    <fbt:param name="total" number={total}>
                      {total}
                    </fbt:param>{" "}
                    the same.
                  </fbt>
                </Tally>
                <Tally
                  id="temporal-polyfill"
                  rows={browser.polyfill}
                  same={count(browser.polyfill)}
                  total={total}
                  none={null}
                >
                  <fbt desc="How many Temporal rows the polyfill in the browser got the same as the Worker">
                    The polyfill in your browser:{" "}
                    <fbt:param name="same">{count(browser.polyfill)}</fbt:param> of{" "}
                    <fbt:param name="total" number={total}>
                      {total}
                    </fbt:param>{" "}
                    the same.
                  </fbt>
                </Tally>
              </>
            )}
          </div>
          <p className="text-sm text-pretty text-muted-foreground">
            <fbt desc="Temporal page: which Temporal runs where">
              On the Worker this app uses Cloudflare's own Temporal (its temporal compatibility
              flag); in the browser, the browser's own, or the polyfill where there is none, as on
              today's iPhones. The polyfill handles the ISO and Gregorian calendars; the Thai
              Buddhist year comes from Intl, on the Intl page.
            </fbt>
          </p>
        </>
      }
      sections={TEMPORAL_SECTIONS.map((s) => ({ id: s.id, title: temporalTitle(s.id) }))}
    >
      {TEMPORAL_SECTIONS.map((section) => (
        <RowsSection
          key={section.id}
          id={section.id}
          title={temporalTitle(section.id)}
          cell="whitespace-normal break-all align-top font-mono text-xs"
          heads={[
            {
              label: (
                <fbt desc="Temporal table column: the result on the Cloudflare Worker, with Cloudflare's own Temporal (what the app runs)">
                  Worker
                </fbt>
              ),
            },
            {
              label: (
                <fbt desc="Temporal table column: the result with the polyfill, on the Worker">
                  Polyfill on Worker
                </fbt>
              ),
            },
            {
              label: (
                <fbt desc="Temporal table column: the result with the browser's own Temporal">
                  Browser's own
                </fbt>
              ),
            },
            {
              label: (
                <fbt desc="Temporal table column: the result with the polyfill, in the browser">
                  Polyfill in browser
                </fbt>
              ),
            },
          ]}
          rows={section.rows.map((row) => {
            const key = `${section.id}/${row.id}`;
            const shown = (rows: Rows | null | undefined) =>
              rows === undefined ? "…" : rows === null ? "—" : rows[key];
            return {
              key,
              code: row.code,
              differs: columns.some((c) => c.rows && c.rows[key] !== reference[key]),
              cells: columns.map((c) => ({ side: c.side, dir: "ltr", content: shown(c.rows) })),
            };
          })}
        />
      ))}
    </DocsPage>
  );
}
