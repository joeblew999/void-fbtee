// The Temporal page, a reference: date and time arithmetic with Temporal, each result a neutral
// value (lib/temporal.ts), run four ways: on the Worker (the loader) with the polyfill and with
// Cloudflare's own Temporal, and in the browser after hydration, with its own and with the
// polyfill. Neutral results must match everywhere, so a highlighted row is a real bug, and its
// columns say whose. The reference is the polyfill on the Worker: what void-fbtee's code runs.
// Formatting is on Formats.
import { Fragment, useSyncExternalStore } from "react";
import { fbt } from "fbtee";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ownTemporal, Polyfill, runTemporal, TEMPORAL_SECTIONS } from "../../../lib/temporal";
import { temporalTitle } from "../../../lib/temporal-titles";
import { cn } from "@/lib/utils";
import type { Props } from "./temporal.server";

type Rows = Record<string, string>;
interface BrowserRows {
  /** With the browser's own Temporal; null if it has none. */
  own: Rows | null;
  /** With temporal-polyfill, in the browser. */
  polyfill: Rows;
}

// The browser's rows: none while hydrating (the server sent none), then worked out once.
const noSubscribe = () => () => {};
let browserRows: BrowserRows | undefined;
const useBrowserRows = () =>
  useSyncExternalStore(
    noSubscribe,
    () => {
      const own = ownTemporal();
      return (browserRows ??= {
        own: own ? runTemporal(own) : null,
        polyfill: runTemporal(Polyfill),
      });
    },
    () => null,
  );

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
  const browser = useBrowserRows();
  const reference = worker.polyfill;
  const keys = Object.keys(reference);
  const count = (rows: Rows | null) =>
    rows ? keys.filter((k) => rows[k] === reference[k]).length : 0;
  const total = keys.length;
  // The four ways, in column order (undefined: the browser hasn't run yet; null: no Temporal of
  // its own there).
  const columns: { side: string; rows: Rows | null | undefined }[] = [
    { side: "worker", rows: worker.polyfill },
    { side: "worker-own", rows: worker.own },
    { side: "own", rows: browser ? browser.own : undefined },
    { side: "polyfill", rows: browser ? browser.polyfill : undefined },
  ];
  const cell = "whitespace-normal break-all align-top font-mono text-xs";
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="temporal-title">
          Temporal
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Temporal page introduction">
            Temporal does the arithmetic on dates and times. Each result is a neutral value, not
            text for the screen, so it must come out the same everywhere. Each row ran on the Worker
            with the temporal-polyfill package and with Cloudflare's own Temporal, and again in your
            browser: with its own Temporal, and with the polyfill. A highlighted row is a real bug,
            and its columns show whose.
          </fbt>
        </p>
        <div className="flex min-h-6 flex-wrap gap-2">
          <Tally
            id="temporal-worker-own"
            rows={worker.own}
            same={count(worker.own)}
            total={total}
            none={
              <fbt desc="The Worker has no Temporal of its own (Cloudflare's compatibility flag is off)">
                The Worker has no Temporal of its own.
              </fbt>
            }
          >
            <fbt desc="How many Temporal rows Cloudflare's own Temporal got the same as the polyfill">
              Cloudflare's own Temporal: <fbt:param name="same">{count(worker.own)}</fbt:param> of{" "}
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
          <fbt desc="Temporal page: why the Worker always uses the polyfill">
            void-fbtee's code on the Worker always uses the polyfill, not Cloudflare's own Temporal,
            which once shipped broken; its column shows how it does today. The polyfill handles the
            ISO and Gregorian calendars; the Thai Buddhist year comes from Intl, on Formats.
          </fbt>
        </p>
      </div>
      {TEMPORAL_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          data-section={section.id}
          className="scroll-mt-20 pt-6"
        >
          <h2 className="border-b pb-2 text-2xl font-medium">{temporalTitle(section.id)}</h2>
          <div className="mt-2">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <fbt desc="Temporal table column: the result on the Cloudflare Worker, with the polyfill">
                      Worker
                    </fbt>
                  </TableHead>
                  <TableHead>
                    <fbt desc="Temporal table column: the result with Cloudflare's own Temporal, on the Worker">
                      Cloudflare's own
                    </fbt>
                  </TableHead>
                  <TableHead>
                    <fbt desc="Temporal table column: the result with the browser's own Temporal">
                      Browser's own
                    </fbt>
                  </TableHead>
                  <TableHead>
                    <fbt desc="Temporal table column: the result with the polyfill, in the browser">
                      Polyfill in browser
                    </fbt>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => {
                  const key = `${section.id}/${row.id}`;
                  const shown = (rows: Rows | null | undefined) =>
                    rows === undefined ? "…" : rows === null ? "—" : rows[key];
                  const differs = columns.some((c) => c.rows && c.rows[key] !== reference[key]);
                  return (
                    <Fragment key={key}>
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableCell colSpan={4} dir="ltr" className={cn(cell, "pt-3 pb-0")}>
                          <code className="text-muted-foreground">{row.code}</code>
                        </TableCell>
                      </TableRow>
                      <TableRow
                        data-row={key}
                        className={differs ? "bg-brand/10" : undefined}
                        data-differs={differs || undefined}
                      >
                        {columns.map((c) => (
                          <TableCell key={c.side} className={cell} data-side={c.side} dir="ltr">
                            {shown(c.rows)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  );
}
