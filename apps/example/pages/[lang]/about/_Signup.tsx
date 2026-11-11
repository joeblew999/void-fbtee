// An island: hydrates on its own, with only its props. No layout, no Void router, so it wraps
// itself in LocaleDirection for shadcn's menu to open the right way in Arabic.
import { useState, useSyncExternalStore } from "react";
import { fbt } from "fbtee";
import { Link, useLocale } from "void-fbtee/react";
import LocaleDirection from "@/components/LocaleDirection";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// True once running in the browser. The menu renders only then: its trigger's id comes from React's
// useId(), which differs between the server (the island inside the whole page) and the browser (the
// island hydrated on its own), so hydrating it would mismatch. Void 1.7.0 (plan #1, Upstream).
const noSubscribe = () => () => {};
const useInBrowser = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

export default function Signup({ seats }: { seats: number }) {
  const { locale, dir } = useLocale();
  const [count, setCount] = useState(seats);
  const inBrowser = useInBrowser();
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  return (
    <LocaleDirection>
      <Card data-testid="signup" className="mb-6 max-w-md">
        <CardHeader>
          <CardTitle data-testid="signup-text">
            <fbt desc="Seats left, island">
              <fbt:plural count={count} showCount="yes" many="seats left">
                seat left
              </fbt:plural>
            </fbt>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="signup-number">
            {number(count * 1234.5)}
          </Badge>
          <Button
            data-testid="signup-take"
            type="button"
            onClick={() => setCount((n) => Math.max(0, n - 1))}
          >
            <fbt desc="Button that takes one seat">Take a seat</fbt>
          </Button>
          {inBrowser ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" data-testid="signup-menu" />}>
                <fbt desc="Menu button: choose how many seats are left">Seats</fbt>
              </DropdownMenuTrigger>
              {/* dir on the popup: shadcn's workaround for tw-animate-css in right-to-left. */}
              <DropdownMenuContent dir={dir} data-testid="signup-menu-content">
                {[1, 2, 3, 4].map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onClick={() => setCount(n)}
                    data-testid={`signup-seats-${n}`}
                  >
                    {number(n)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" disabled data-testid="signup-menu">
              <fbt desc="Menu button: choose how many seats are left">Seats</fbt>
            </Button>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {/* void-fbtee's Link inside an island, where there is no Void router. */}
          <Link
            href="/ar-EG/about"
            className={buttonVariants({ variant: "link" })}
            data-testid="signup-to-ar"
          >
            العربية
          </Link>
          <Link
            href={`/${locale}/docs` as never}
            className={buttonVariants({ variant: "link" })}
            data-testid="signup-to-docs"
          >
            <fbt desc="Navigation: the documentation">Docs</fbt>
          </Link>
        </CardFooter>
      </Card>
    </LocaleDirection>
  );
}
