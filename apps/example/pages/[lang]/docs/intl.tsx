// The Intl page, a reference: every Intl call the example knows, in the page's language. The
// Worker's column (the loader) is the text a void-fbtee app's pages show; the browser's, run after
// hydration, shows where its engine's own locale data writes it differently, every such row
// highlighted (lib/differs.ts), with invisible characters shown by name and, for the supported
// values, only what differs. Pages don't depend
// on the two agreeing: text formatted while rendering is <Formatted>, the server's kept. "Your
// time zone" and the time in it are the browser's alone: empty until it knows the zone. Temporal
// is on its own page (docs/temporal).
import { Fragment, useSyncExternalStore } from "react";
import { fbt } from "fbtee";
import { Formatted, useLocale, useTimeZone } from "void-fbtee/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INSTANT, runAll, SECTIONS, ZONE } from "../../../lib/intl";
import { sectionTitle } from "../../../lib/intl-titles";
import { cn } from "@/lib/utils";
import { DIFFERS_ROW, listDifference, showInvisible } from "../../../lib/differs";
import type { Props } from "./intl.server";

// The browser's rows: none while hydrating (the server sent none), then computed once.
const noSubscribe = () => () => {};
const browserRows = new Map<string, Record<string, string>>();
function useBrowserRows(locale: string): Record<string, string> | null {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      if (!browserRows.has(locale)) browserRows.set(locale, runAll(locale));
      return browserRows.get(locale)!;
    },
    () => null,
  );
}

/** A row listing an engine's supported values (the "supported" section), not a format. */
const isInventory = (key: string) => key.startsWith("supported/");

/** The browser's side of a supported-values row that differs: only what's not in both lists. */
function ListDifference({ worker, browser }: { worker: string; browser: string }) {
  const { onlyWorker, onlyBrowser } = listDifference(worker, browser);
  return (
    <>
      {browser.split(":")[0]}.{" "}
      {onlyWorker.length > 0 && (
        <fbt desc="Intl page: supported values the Worker has and the browser doesn't">
          Only on the Worker: <fbt:param name="values">{onlyWorker.join(", ")}</fbt:param>.
        </fbt>
      )}{" "}
      {onlyBrowser.length > 0 && (
        <fbt desc="Intl page: supported values the browser has and the Worker doesn't">
          Only in your browser: <fbt:param name="values">{onlyBrowser.join(", ")}</fbt:param>.
        </fbt>
      )}
    </>
  );
}

export default function IntlPage({ worker }: Props) {
  const { locale, dir } = useLocale();
  const browser = useBrowserRows(locale);
  const keys = Object.keys(worker);
  const same = browser ? keys.filter((k) => browser[k] === worker[k]).length : 0;
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="intl-title">
          Intl
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Intl page introduction">
            Each row is one call to the platform's own Intl, in this page's language. The Worker ran
            it before sending the page: that's the text this app's pages show. Your browser ran it
            again with its own engine.
          </fbt>
        </p>
        {/* Once the browser has run every row: how many match the Worker's. Its line is kept free
            meanwhile, so the page doesn't shift when it appears. */}
        <div className="min-h-6">
          {browser && (
            <Badge
              variant={same === keys.length ? "secondary" : "outline"}
              data-testid="intl-match"
            >
              <fbt desc="How many rows the browser formatted exactly as the Worker did">
                <fbt:param name="same">{number(same)}</fbt:param> of{" "}
                <fbt:param name="total" number={keys.length}>
                  {number(keys.length)}
                </fbt:param>{" "}
                rows are the same in your browser.
              </fbt>
            </Badge>
          )}
        </div>
        <p className="text-sm text-pretty text-muted-foreground">
          <fbt desc="Intl page: what a highlighted row means">
            A highlighted row is where your browser's engine writes it differently: each engine
            ships its own locale data. Pages show the server's text, so they don't depend on the two
            agreeing. In a highlighted row, characters that print as nothing are shown by name, such
            as ⟨RLM⟩, and the supported-value lists show only what differs.
          </fbt>
        </p>
      </div>
      <PageFacts />
      <p className="text-sm text-muted-foreground">
        <fbt desc="Where the times on the Intl page are shown">
          The times below are <fbt:param name="instant">{INSTANT}</fbt:param>, shown in{" "}
          <fbt:param name="zone">{ZONE}</fbt:param>.
        </fbt>
      </p>
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          data-section={section.id}
          className="scroll-mt-20 pt-6"
        >
          <h2 className="border-b pb-2 text-2xl font-medium">{sectionTitle(section.id)}</h2>
          <div className="mt-2">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">
                    <fbt desc="Intl table column: the result on the Cloudflare Worker">Worker</fbt>
                  </TableHead>
                  <TableHead>
                    <fbt desc="Intl table column: the result in the visitor's browser">
                      Your browser
                    </fbt>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => {
                  const key = `${section.id}/${row.id}`;
                  const differs = browser !== null && browser[key] !== worker[key];
                  const cell = "whitespace-normal break-words align-top";
                  return (
                    <Fragment key={key}>
                      {/* The call, across both columns; its results in the row below. */}
                      <TableRow className="border-b-0 hover:bg-transparent">
                        <TableCell colSpan={2} dir="ltr" className={cn(cell, "pt-3 pb-0")}>
                          <code className="font-mono text-xs text-muted-foreground">
                            {row.code.replace(/\blang\b/g, JSON.stringify(locale))}
                          </code>
                        </TableCell>
                      </TableRow>
                      <TableRow
                        data-row={key}
                        className={differs ? DIFFERS_ROW : undefined}
                        data-differs={differs || undefined}
                      >
                        <TableCell className={cell} data-side="worker" dir={dir}>
                          {differs ? showInvisible(worker[key]!) : worker[key]}
                        </TableCell>
                        <TableCell className={cell} data-side="browser" dir={dir}>
                          {!browser ? (
                            "…"
                          ) : !differs ? (
                            browser[key]
                          ) : isInventory(key) ? (
                            <ListDifference worker={worker[key]!} browser={browser[key]!} />
                          ) : (
                            showInvisible(browser[key]!)
                          )}
                        </TableCell>
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

/** The page's language as Intl sees it. */
function PageFacts() {
  const { locale, dir } = useLocale();
  const zone = useTimeZone();
  const tag = new Intl.Locale(locale);
  const resolved = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).resolvedOptions();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <fbt desc="Intl card heading: facts about this page's language">This page</fbt>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl
          className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr_max-content_1fr]"
          data-testid="page-facts"
        >
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: the page's language">Language</fbt>
          </dt>
          <dd>
            <Formatted>{`${locale} (${tag.maximize().toString()})`}</Formatted>
          </dd>
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: left-to-right or right-to-left">Direction</fbt>
          </dt>
          <dd>{dir}</dd>
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: the language's calendar">Calendar</fbt>
          </dt>
          <dd>
            <Formatted>{resolved.calendar}</Formatted>
          </dd>
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: the language's digits">Digits</fbt>
          </dt>
          <dd>
            <Formatted>{resolved.numberingSystem}</Formatted>
          </dd>
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: 12- or 24-hour clock">Clock</fbt>
          </dt>
          <dd>
            <Formatted>{resolved.hourCycle ?? ""}</Formatted>
          </dd>
          <dt className="text-muted-foreground">
            <fbt desc="Page fact: the visitor's time zone, from their browser">Your time zone</fbt>
          </dt>
          <dd data-testid="page-zone">{zone}</dd>
        </dl>
        <YourTimeZone />
      </CardContent>
    </Card>
  );
}

/** The instant again, in the visitor's own time zone: only the browser knows it. */
function YourTimeZone() {
  const { locale } = useLocale();
  const zone = useTimeZone();
  return (
    <p className="min-h-5 text-sm" data-testid="your-time">
      {zone && (
        <fbt desc="The same moment in the visitor's own time zone">
          In your time zone:{" "}
          <fbt:param name="time">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "full",
              timeStyle: "long",
              timeZone: zone,
            }).format(new Date(INSTANT))}
          </fbt:param>
        </fbt>
      )}
    </p>
  );
}
