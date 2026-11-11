// "Try it": a number typed your language's way and some text, formatted by the Worker and by the
// browser. It shows the inbound half of neutral data: the browser reads the typed number back
// (parseNumber), so what goes to the Worker (routes/api/format.ts) is a number, never text.
import { useState } from "react";
import { fbs, fbt } from "fbtee";
import { fetch } from "void/client";
import { useHydrated, useLocale } from "void-fbtee/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { parseNumber } from "../../../lib/parse-number";
import { tryIt } from "../../../lib/try-it";

type TryItResult = ReturnType<typeof tryIt>;

/**
 * A number typed your language's way and some text, formatted by the Worker and by the browser.
 * The browser reads the number back first (parseNumber), so what goes to the Worker is neutral:
 * 2500.75, not "٢٬٥٠٠٫٧٥". The browser's column waits for hydration, as it's the browser's own.
 */
export default function TryIt() {
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
    <div className="min-w-0 space-y-6" data-testid="try-it">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="try-title">
          <fbt desc="Try it page heading: type a number and text, see them formatted">Try it</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Try it page introduction">
            Type a number the way your language writes it, and any text. Your browser reads the
            number back to a plain number, and that's what goes to the Worker: data travels neutral,
            never as formatted text. Both then format it with their own Intl.
          </fbt>
        </p>
      </div>
      <div className="space-y-4">
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
      </div>
    </div>
  );
}
