// The formats page, a reference: every Intl call the example knows, in the page's language. The
// Worker's column (the loader) is the text a void-fbtee app's pages show; the browser's, run after
// hydration, shows where its engine's own locale data writes it differently. Pages don't depend
// on the two agreeing: text formatted while rendering is <Formatted>, the server's kept. "Your
// time zone" and the time in it are the browser's alone: empty until it knows the zone. Temporal
// is on its own page (docs/temporal).
import { Fragment, useState, useSyncExternalStore } from "react";
import { fbs, fbt } from "fbtee";
import { fetch } from "void/client";
import { Formatted, useHydrated, useLocale, useTimeZone } from "void-fbtee/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INSTANT, runAll, SECTIONS, ZONE } from "../../../lib/formats";
import { sectionTitle } from "../../../lib/formats-titles";
import { parseNumber } from "../../../lib/parse-number";
import { tryIt } from "../../../lib/try-it";
import { cn } from "@/lib/utils";
import type { Props } from "./formats.server";

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

export default function FormatsPage({ worker }: Props) {
  const { locale, dir } = useLocale();
  const browser = useBrowserRows(locale);
  // The rows that format something. The "supported" rows list each engine's own inventory
  // (Intl.supportedValuesOf), which differs between engines by design, so they're shown, not compared.
  const keys = Object.keys(worker).filter((k) => !isInventory(k));
  const same = browser ? keys.filter((k) => browser[k] === worker[k]).length : 0;
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="formats-title">
          <fbt desc="Formats page heading">Formats</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Formats page introduction">
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
              data-testid="formats-match"
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
          <fbt desc="Formats page: what a highlighted row means">
            A highlighted row is where your browser's engine writes it differently: each engine
            ships its own locale data. Pages show the server's text, so they don't depend on the two
            agreeing. The supported-value lists at the end are each engine's own, so they aren't
            compared.
          </fbt>
        </p>
      </div>
      <PageFacts />
      <TryIt />
      <p className="text-sm text-muted-foreground">
        <fbt desc="Where the times on the formats page are shown">
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
                    <fbt desc="Formats table column: the result on the Cloudflare Worker">
                      Worker
                    </fbt>
                  </TableHead>
                  <TableHead>
                    <fbt desc="Formats table column: the result in the visitor's browser">
                      Your browser
                    </fbt>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => {
                  const key = `${section.id}/${row.id}`;
                  const differs =
                    browser !== null && !isInventory(key) && browser[key] !== worker[key];
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
                        className={differs ? "bg-brand/10" : undefined}
                        data-differs={differs || undefined}
                      >
                        <TableCell className={cell} data-side="worker" dir={dir}>
                          {worker[key]}
                        </TableCell>
                        <TableCell className={cell} data-side="browser" dir={dir}>
                          {browser ? browser[key] : "…"}
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
          <fbt desc="Formats card heading: facts about this page's language">This page</fbt>
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

type TryItResult = ReturnType<typeof tryIt>;

/**
 * A number typed your language's way and some text, formatted by the Worker and by the browser.
 * The browser reads the number back first (parseNumber), so what goes to the Worker is neutral:
 * 2500.75, not "٢٬٥٠٠٫٧٥". The browser's column waits for hydration, as it's the browser's own.
 */
function TryIt() {
  const { locale } = useLocale();
  const [numberText, setNumberText] = useState(() =>
    new Intl.NumberFormat(locale).format(1234567.891),
  );
  const [text, setText] = useState(() =>
    String(
      fbs("Void apps speak every language. Intl does the rest.", "Sample text to split into words"),
    ),
  );
  const [worker, setWorker] = useState<TryItResult | null>(null);
  const hydrated = useHydrated();
  const value = parseNumber(locale, numberText);
  const browser = tryIt(locale, value, text);
  async function formatOnServer() {
    const number = Number.isNaN(value) ? null : value;
    setWorker(await fetch("/api/format", { method: "POST", body: { locale, number, text } }));
  }
  const rows: [string, (r: TryItResult) => unknown][] = [
    ["value", (r) => r.value],
    ...Object.keys(browser.formats).map((k): [string, (r: TryItResult) => unknown] => [
      k,
      (r) => (r.formats as Record<string, string>)[k],
    ]),
    ["characters", (r) => r.characters],
    ["words", (r) => r.words.join(" · ")],
  ];
  return (
    <Card data-testid="try-it">
      <CardHeader>
        <CardTitle>
          <fbt desc="Formats section where the visitor types a number and text">Try it</fbt>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="try-number">
              <fbt desc="Input label: a number, written the visitor's way">
                A number, written your way
              </fbt>
            </Label>
            <Input
              id="try-number"
              data-testid="try-number"
              value={numberText}
              onChange={(e) => setNumberText(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="try-text">
              <fbt desc="Input label: any text">Some text</fbt>
            </Label>
            <Input
              id="try-text"
              data-testid="try-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" data-testid="try-server" onClick={formatOnServer}>
          <fbt desc="Button: send the number and text to the server to format">
            Format on the server
          </fbt>
        </Button>
        <Table>
          <TableBody>
            {rows.map(([name, get]) => (
              <TableRow key={name} data-try={name}>
                <TableHead dir="ltr" className="w-40">
                  {name}
                </TableHead>
                <TableCell data-side="worker" className="whitespace-normal">
                  {worker ? String(get(worker)) : "—"}
                </TableCell>
                <TableCell data-side="browser" className="whitespace-normal">
                  {hydrated ? String(get(browser)) : "…"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
