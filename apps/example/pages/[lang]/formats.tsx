// The formats page: every Intl call the example knows, run on the Worker (the loader) and again in
// your browser, side by side. They match when the Worker's Intl and the browser's agree, which is
// what server rendering with Intl depends on. Times "in your time zone" are the browser's alone.
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { fbs, fbt } from "fbtee";
import { useLocale, useTimeZone } from "void-fbtee/react";
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
import Nav from "../../components/Nav";
import { INSTANT, runAll, SECTIONS, ZONE, type SectionId } from "../../lib/formats";
import { parseNumber } from "../../lib/parse-number";
import { tryIt } from "../../lib/try-it";
import type { Props } from "./formats.server";

function title(id: SectionId): ReactNode {
  switch (id) {
    case "dates":
      return <fbt desc="Formats section: dates and times">Dates and times</fbt>;
    case "zones":
      return <fbt desc="Formats section: named time zones">Time zones</fbt>;
    case "ranges":
      return <fbt desc="Formats section: date ranges">Date ranges</fbt>;
    case "relative":
      return <fbt desc="Formats section: relative time, like 'yesterday'">Relative time</fbt>;
    case "numbers":
      return <fbt desc="Formats section: numbers">Numbers</fbt>;
    case "currency":
      return <fbt desc="Formats section: money">Currency</fbt>;
    case "units":
      return <fbt desc="Formats section: units of measure">Units</fbt>;
    case "plurals":
      return <fbt desc="Formats section: plural rules">Plural rules</fbt>;
    case "lists":
      return <fbt desc="Formats section: lists of items">Lists</fbt>;
    case "durations":
      return <fbt desc="Formats section: lengths of time">Durations</fbt>;
    case "names":
      return <fbt desc="Formats section: names of languages, regions and currencies">Names</fbt>;
    case "collation":
      return <fbt desc="Formats section: sorting text">Sorting</fbt>;
    case "segments":
      return (
        <fbt desc="Formats section: splitting text into characters, words and sentences">
          Splitting text
        </fbt>
      );
    case "locale":
      return <fbt desc="Formats section: facts about this page's language">This language</fbt>;
    case "supported":
      return <fbt desc="Formats section: everything this Intl supports">Supported values</fbt>;
    case "temporal":
      return <fbt desc="Formats section: dates with Temporal">Temporal</fbt>;
    case "strings":
      return (
        <fbt desc="Formats section: translated strings with fbtee">Translated strings (fbtee)</fbt>
      );
  }
}

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

export default function FormatsPage({ worker }: Props) {
  const { locale, dir } = useLocale();
  const browser = useBrowserRows(locale);
  const keys = Object.keys(worker);
  const same = browser ? keys.filter((k) => browser[k] === worker[k]).length : 0;
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <main>
      <Nav page="/formats" />
      <h1 className="mb-2 text-3xl font-semibold" data-testid="formats-title">
        <fbt desc="Formats page heading">Formats</fbt>
      </h1>
      <p className="mb-4 text-muted-foreground">
        <fbt desc="Formats page introduction">
          Each row is one call to the platform's own Intl, in this page's language. The Worker ran
          it before sending the page; your browser ran it again.
        </fbt>
      </p>
      <PageFacts />
      <Badge
        variant={browser && same === keys.length ? "secondary" : "outline"}
        className="mb-4"
        data-testid="formats-match"
      >
        {browser ? (
          <fbt desc="How many rows the browser formatted exactly as the Worker did">
            <fbt:param name="same">{number(same)}</fbt:param> of{" "}
            <fbt:param name="total" number={keys.length}>
              {number(keys.length)}
            </fbt:param>{" "}
            rows are the same in your browser.
          </fbt>
        ) : (
          "…"
        )}
      </Badge>
      <TryIt />
      <YourTimeZone />
      <p className="mb-4 text-sm text-muted-foreground">
        <fbt desc="Where the times on the formats page are shown">
          The times below are <fbt:param name="instant">{INSTANT}</fbt:param>, shown in{" "}
          <fbt:param name="zone">{ZONE}</fbt:param>.
        </fbt>
      </p>
      {SECTIONS.map((section) => (
        <Card key={section.id} data-section={section.id} className="mb-6">
          <CardHeader>
            <CardTitle>{title(section.id)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/5">
                    <fbt desc="Formats table column: the code that was run">Call</fbt>
                  </TableHead>
                  <TableHead>
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
                  const differs = browser !== null && browser[key] !== worker[key];
                  const cell = "whitespace-normal break-words align-top";
                  return (
                    <TableRow
                      key={key}
                      data-row={key}
                      className={differs ? "bg-destructive/10" : undefined}
                    >
                      <TableCell dir="ltr" className={cell}>
                        <code className="font-mono text-xs">
                          {row.code.replace(/\blang\b/g, JSON.stringify(locale))}
                        </code>
                      </TableCell>
                      <TableCell className={cell} data-side="worker" dir={dir}>
                        {worker[key]}
                      </TableCell>
                      <TableCell className={cell} data-side="browser" dir={dir}>
                        {browser ? browser[key] : "…"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}

/** The page's language as Intl sees it. */
function PageFacts() {
  const { locale, dir } = useLocale();
  const zone = useTimeZone();
  const tag = new Intl.Locale(locale);
  const resolved = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).resolvedOptions();
  return (
    <dl
      className="mb-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm"
      data-testid="page-facts"
    >
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: the page's language">Language</fbt>
      </dt>
      <dd>{`${locale} (${tag.maximize().toString()})`}</dd>
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: left-to-right or right-to-left">Direction</fbt>
      </dt>
      <dd>{dir}</dd>
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: the language's calendar">Calendar</fbt>
      </dt>
      <dd>{resolved.calendar}</dd>
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: the language's digits">Digits</fbt>
      </dt>
      <dd>{resolved.numberingSystem}</dd>
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: 12- or 24-hour clock">Clock</fbt>
      </dt>
      <dd>{resolved.hourCycle}</dd>
      <dt className="text-muted-foreground">
        <fbt desc="Page fact: the visitor's time zone, from their browser">Your time zone</fbt>
      </dt>
      <dd data-testid="page-zone">{zone}</dd>
    </dl>
  );
}

/** The instant again, in the visitor's own time zone: only the browser knows it. */
function YourTimeZone() {
  const { locale } = useLocale();
  const zone = useTimeZone();
  const text = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: zone,
  }).format(new Date(INSTANT));
  return (
    <p className="mb-4" data-testid="your-time">
      <fbt desc="The same moment in the visitor's own time zone">
        In your time zone: <fbt:param name="time">{text}</fbt:param>
      </fbt>
    </p>
  );
}

type TryItResult = ReturnType<typeof tryIt>;

/** A number typed your language's way and some text, formatted by the Worker and by the browser. */
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
  const browser = tryIt(locale, parseNumber(locale, numberText), text);
  async function formatOnServer() {
    const res = await fetch("/api/format", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, number: numberText, text }),
    });
    setWorker((await res.json()) as TryItResult);
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
    <Card data-testid="try-it" className="mb-6">
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
                  {String(get(browser))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
