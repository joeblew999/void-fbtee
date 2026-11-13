// Upcoming events as a departure board: one ruled row per event, soonest first. Each row: the date
// and the start on the place's own clock (named by Intl, "Thailand Time"), the start on the
// reader's clock and how far off it is (the browser's alone, filled in once it knows the zone),
// the title and where, and the seats left in a split-flap chip. On a phone each row folds to three
// lines. Posting an event is its own page (new.tsx).
import { routeUrl } from "void/routes";
import { fbt } from "fbtee";
import { ArrowRight, MapPin } from "lucide-react";
import { Formatted, Link, useLocale, useNow, useTimeZone } from "void-fbtee/react";
import { Temporal } from "temporal-polyfill";
import { Flap } from "@/components/Flap";
import { buttonVariants } from "@/components/ui/button";
import { clockParts, otherDay } from "@/lib/event-clock";
import { relativeDays } from "@/lib/relative-days";
import { cn } from "@/lib/utils";
import type { Props } from "./index.server";

type Row = Props["events"][number];

/** The board's columns from 768px; below that each row folds to three lines. */
const COLUMNS = "md:grid-cols-[7.5rem_10rem_10rem_minmax(0,1fr)_8.5rem]";

/** Seats left in a flap, the same words as each event's page; "Sold out" when none. */
function SeatsLeft({ left }: { left: number }) {
  return (
    <Flap value={left} tone={left ? "default" : "out"}>
      {left ? (
        <fbt desc="How many seats an event has left">
          <fbt:plural count={left} many="seats left" showCount="yes">
            seat left
          </fbt:plural>
        </fbt>
      ) : (
        <fbt desc="Badge: an event has no seats left">Sold out</fbt>
      )}
    </Flap>
  );
}

function BoardRow({ e }: { e: Row }) {
  const { locale, lang } = useLocale();
  const reader = useTimeZone();
  // Once a minute, so "tomorrow" becomes "today" on a page left open past midnight.
  const now = useNow({ updateInterval: 60_000 });
  const place = clockParts(e.starts_at, locale);
  const yours = reader ? clockParts(e.starts_at, locale, reader) : null;
  const start = Temporal.ZonedDateTime.from(e.starts_at);
  return (
    <li>
      <Link
        href={routeUrl("/[lang]/events/[id]", { params: { lang, id: e.id } })}
        className={cn(
          "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-1 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:items-start md:px-3 md:py-5",
          COLUMNS,
        )}
      >
        {/* On a phone the date and the place's time share the first line; from 768px each is a column. */}
        <div className="col-start-1 row-start-1 flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
          <div className="flex items-baseline gap-1.5 md:col-start-1 md:row-start-1 md:pt-1">
            <span className="font-medium tabular-nums md:text-2xl md:leading-none">
              <Formatted>{place.day}</Formatted>
            </span>
            <span className="text-muted-foreground text-xs font-medium uppercase">
              <Formatted>{place.month}</Formatted>
            </span>
            <span className="text-muted-foreground text-xs uppercase">
              <Formatted>{place.weekday}</Formatted>
            </span>
          </div>
          <div className="flex items-center gap-2 md:col-start-2 md:row-start-1 md:grid md:justify-items-start md:gap-1.5">
            <Flap value={place.time}>
              <Formatted>{place.time}</Formatted>
            </Flap>
            <span className="text-muted-foreground text-xs">
              <Formatted>{place.zone}</Formatted>
            </span>
          </div>
        </div>
        {/* The reader's clock and how far off: empty (their space kept) until the browser knows the zone. */}
        <div className="col-span-2 row-start-3 flex flex-wrap gap-x-3 text-muted-foreground text-sm md:col-span-1 md:col-start-3 md:row-start-1 md:grid md:gap-1 md:pt-1">
          <span className="min-h-5 md:text-foreground" data-testid="event-yours">
            {yours && reader && (
              <fbt desc="An event's start time on the reader's own clock">
                Your time:{" "}
                <fbt:param name="time">
                  {otherDay(e.starts_at, reader) ? `${yours.weekday} ${yours.time}` : yours.time}
                </fbt:param>
              </fbt>
            )}
          </span>
          <span className="min-h-5" data-testid="event-when">
            {reader && relativeDays(locale, start.withTimeZone(reader), now)}
          </span>
        </div>
        <div className="col-span-2 row-start-2 grid min-w-0 gap-1 md:col-span-1 md:col-start-4 md:row-start-1">
          <span
            className="text-base font-medium text-pretty md:text-lg md:leading-snug"
            lang={e.text ? locale : e.locale}
            data-testid="event-title"
          >
            {e.text?.title ?? e.title}
          </span>
          {e.venue && (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{e.venue}</span>
            </span>
          )}
        </div>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-3 md:col-start-5 md:pt-0.5">
          <SeatsLeft left={e.left} />
          <ArrowRight
            aria-hidden
            className="hidden size-4 text-brand transition-transform duration-200 group-hover:translate-x-1 md:block rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
          />
        </div>
      </Link>
    </li>
  );
}

export default function Events({ events }: Props) {
  const { lang } = useLocale();
  const post = routeUrl("/[lang]/events/new", { params: { lang } });
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="text-3xl font-medium text-balance" data-testid="events-title">
            <fbt desc="Heading of the events page">Upcoming events</fbt>
          </h1>
          <p className="max-w-xl text-muted-foreground text-pretty">
            <fbt desc="Under the events page's heading">
              Every start on the clock where it happens, and on yours.
            </fbt>
          </p>
        </div>
        <Link href={post} className={buttonVariants({ size: "lg" })} data-testid="post-link">
          <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
        </Link>
      </div>
      {events.length ? (
        <section className="border-y">
          <div
            aria-hidden
            className={cn(
              "hidden gap-x-4 border-b px-3 py-2.5 text-muted-foreground text-xs font-medium uppercase md:grid",
              COLUMNS,
            )}
          >
            <span>
              <fbt desc="Events board column: the day an event is on">Date</fbt>
            </span>
            <span>
              <fbt desc="Events board column: start time on the clock where the event happens">
                Starts, local
              </fbt>
            </span>
            <span>
              <fbt desc="Events board column: start time on the reader's clock">Your time</fbt>
            </span>
            <span>
              <fbt desc="Events board column: the event's title and place">Event</fbt>
            </span>
            <span className="text-end">
              <fbt desc="Events board column: seats still free">Seats</fbt>
            </span>
          </div>
          <ul className="divide-y" data-testid="events-list">
            {events.map((e) => (
              <BoardRow key={e.id} e={e} />
            ))}
          </ul>
        </section>
      ) : (
        <div className="grid justify-items-start gap-4 border-y py-12" data-testid="events-empty">
          <p className="text-lg font-medium">
            <fbt desc="Events page when nothing is coming up">Nothing coming up yet.</fbt>
          </p>
          <p className="max-w-xl text-muted-foreground">
            <fbt desc="Events page when nothing is coming up: what posting does">
              Post one in any language: it shows here in every language, on every reader's clock.
            </fbt>
          </p>
          <Link href={post} className={buttonVariants({ variant: "outline" })}>
            <fbt desc="Heading of the form for posting a new event">Post an event</fbt>
          </Link>
        </div>
      )}
    </div>
  );
}
