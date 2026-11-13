// One event, laid out like a departure board's detail: the title and where, then a ruled band with
// the date on the place's clock and the start on both clocks, the story, and booking beside it
// (below it on a phone, with a bar fixed to the bottom that takes you there). The title and
// description are in the language the organiser wrote them in (marked with lang, so the browser and
// screen readers use the right one); the seats left are live, in a split-flap chip that turns over
// as people book; booking is Void's useForm, with the page's language filled in (void-fbtee/react).
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fbs, fbt } from "fbtee";
import { action, Form, isVoidActionError, useRouter } from "@void/react";
import { routeUrl } from "void-fbtee/routes";
import { connectLiveStream } from "void/live/client";
import {
  Formatted,
  langAttrs,
  useForm,
  useHydrated,
  useLocale,
  useTimeZone,
} from "void-fbtee/react";
import { MapPin } from "lucide-react";
import { EventTime } from "@/events/EventTime";
import { EventsCrumbs } from "@/events/EventsCrumbs";
import { Flap } from "@/events/Flap";
import { Button, buttonVariants } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { clockParts } from "@/events/event-clock";
import { keyCookieName } from "@/events/delete-key";
import type { Props } from "./[id].server";

/**
 * The event's live stream: the seats left (seats only go down, so the lower count wins), and its
 * translations arriving after the post (queues/translate.ts): then the page loads its data again.
 */
function useLiveEvent(id: string, left: number) {
  const [live, setLive] = useState(Infinity);
  const router = useRouter();
  useEffect(() => {
    const stream = connectLiveStream("/api/live");
    let closed = false;
    stream
      .subscribe({
        id: "event",
        topic: `event:${id}`,
        onEvent: (event) => {
          if (event.type === "seats") setLive((event.data as { left: number }).left);
          if (event.type === "translated") void router.refresh();
        },
      })
      // Closed by this effect's cleanup before subscribing finished: not an error.
      .catch((error: unknown) => {
        if (!closed) throw error;
      });
    return () => {
      closed = true;
      stream.close();
    };
  }, [id, router]);
  return Math.min(left, live);
}

/** Whether an element is on screen, once the browser can tell (false before). */
function useOnScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const watch = new IntersectionObserver(([entry]) => setOn(entry!.isIntersecting));
    watch.observe(ref.current);
    return () => watch.disconnect();
  }, []);
  return [ref, on] as const;
}

/**
 * Booking, in the reader's zone (Event remounts it once the browser knows it). On a phone, while
 * there's a seat to book and the form is off screen, a bar fixed to the bottom takes you to it.
 */
function Book({ id, zone, soldOut }: { id: string; zone: string | null; soldOut: boolean }) {
  const [here, formOnScreen] = useOnScreen();
  const form = useForm(
    "/[lang]/events/[id]?default",
    { name: "", email: "", time_zone: zone ?? "" },
    { params: { id } },
  );
  if (form.wasSuccessful)
    return (
      <p className="font-medium" data-testid="booked">
        <fbt desc="Shown after booking a seat on an event">You're booked. See you there!</fbt>
      </p>
    );
  // The 409 from the action: someone else took the last seat (the live count may say so first).
  if (form.error?.status === 409)
    return (
      <p className="text-destructive text-sm" data-testid="sold-out-error">
        <fbt desc="Booking error: the last seat went just before">
          Sorry, the last seat has just gone.
        </fbt>
      </p>
    );
  if (soldOut) return null;
  return (
    <div ref={here}>
      <Form form={form} className="grid gap-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="book-name">
              <fbt desc="Booking form label: the booker's name">Your name</fbt>
            </Label>
            <Input
              id="book-name"
              data-testid="book-name"
              value={form.data.name}
              onChange={(e) => form.setData("name", e.target.value)}
            />
            {form.errors.name && (
              <p className="text-destructive text-sm" data-testid="error-name">
                <fbt desc="Booking form error: no name">What's your name?</fbt>
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-email">
              <fbt desc="Booking form label: the booker's email address">Email</fbt>
            </Label>
            <Input
              id="book-email"
              type="email"
              data-testid="book-email"
              value={form.data.email}
              onChange={(e) => form.setData("email", e.target.value)}
            />
            {form.errors.email && (
              <p className="text-destructive text-sm" data-testid="error-email">
                <fbt desc="Booking form error: not an email address">
                  That's not an email address.
                </fbt>
              </p>
            )}
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={form.pending}
          data-testid="book"
          className="w-full"
        >
          <fbt desc="Button under the booking form's name and email: books the seat">Book</fbt>
        </Button>
        <div
          hidden={formOnScreen}
          className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden"
        >
          <a
            href="#book"
            onClick={(e) => {
              // Scroll to the form ourselves, then put the cursor in its first field.
              e.preventDefault();
              document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
              document.getElementById("book-name")?.focus({ preventScroll: true });
            }}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            <fbt desc="Button: book a seat on the event">Book a seat</fbt>
          </a>
        </div>
      </Form>
    </div>
  );
}

/**
 * The event as it's saved in the database: neutral data, the same in every language. Everything
 * else on the page is formatted from it, in the page's language and the reader's zone.
 */
function Stored({ event }: { event: Props["event"] }) {
  const fields = {
    starts_at: event.starts_at,
    starts_at_utc: event.starts_at_utc,
    seats: event.seats,
    locale: event.locale,
  };
  return (
    <section className="grid gap-2 border-t pt-8 text-sm">
      <h2 className="font-medium">
        <fbt desc="Heading of the box showing an event exactly as it's saved in the database">
          Stored as
        </fbt>
      </h2>
      <p className="text-muted-foreground">
        <fbt desc="Under 'Stored as': what the box shows and why it never changes">
          Exactly as it's saved, whatever language you read it in. Everything above is written from
          it, for your language and your clock.
        </fbt>
      </p>
      <dl
        dir="ltr"
        className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/40 p-4 font-mono text-xs"
        data-testid="event-stored"
      >
        {Object.entries(fields).map(([name, value]) => (
          <Fragment key={name}>
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="break-all">{String(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

/** The date on the place's clock, as a board's tile: the day large, the month and weekday under it. */
function DateTile({ startsAt }: { startsAt: string }) {
  const { locale } = useLocale();
  const place = clockParts(startsAt, locale);
  return (
    <div className="grid w-20 shrink-0 justify-items-center gap-1 rounded-lg bg-secondary px-2 py-3 ring-1 ring-border">
      <span className="text-xs font-medium text-muted-foreground uppercase">
        <Formatted>{place.month}</Formatted>
      </span>
      <span className="text-3xl leading-none font-medium tabular-nums">
        <Formatted>{place.day}</Formatted>
      </span>
      <span className="text-xs text-muted-foreground uppercase">
        <Formatted>{place.weekday}</Formatted>
      </span>
    </div>
  );
}

/** The address's "#" part, following changes to it (a link pasted into an open page); none on the server. */
const onHashChange = (changed: () => void) => {
  addEventListener("hashchange", changed);
  return () => removeEventListener("hashchange", changed);
};

/** The event's key, from its private link ("#key=…"), or the cookie posting just set. */
function keyHere(id: string, hash: string): string | null {
  const fromLink = new URLSearchParams(hash.slice(1)).get("key");
  const name = `${keyCookieName(id)}=`;
  const fromCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(name))
    ?.slice(name.length);
  return fromLink ?? fromCookie ?? null;
}

/**
 * For whoever posted the event: its private delete link (src/events/delete-key.ts). Only in the
 * browser, which alone sees the "#" part, and only for an event that can be deleted. Just after
 * posting, the key comes in a cookie: it moves into this page's own address, so reloading or
 * bookmarking the page keeps the link, and the cookie goes. Deleting asks once more, on the page
 * (no browser dialog).
 */
function YourEvent({ id }: { id: string }) {
  const { lang } = useLocale();
  // The address and cookies are the browser's own: read once hydrated, so the server's HTML and the
  // first render in the browser are the same (nothing), as useHydrated is for.
  const hydrated = useHydrated();
  const hash = useSyncExternalStore(
    onHashChange,
    () => location.hash,
    () => "",
  );
  const key = hydrated ? keyHere(id, hash) : null;
  const [sure, setSure] = useState(false);
  const [wrong, setWrong] = useState(false);
  // The event's own address, not location's: just after posting, this renders before Void's router
  // has moved the address from the form's page to this one.
  const page = routeUrl("/[lang]/events/[id]", { params: { id } });
  useEffect(() => {
    if (!key || location.pathname !== page || location.hash.includes("key=")) return;
    history.replaceState(history.state, "", `${page}${location.search}#key=${key}`);
    document.cookie = `${keyCookieName(id)}=; Path=/; Max-Age=0`;
  }, [id, key, page]);
  if (!key) return null;
  const link = `${location.origin}${page}#key=${key}`;
  const remove = async () => {
    // A wrong key is a 403, which Void's action() throws rather than returns (it returns only
    // 400, 404, 409, 422 and 429: guide/pages-routing/actions-and-forms.md). Deleted, the action
    // redirects to the list.
    try {
      await action("/[lang]/events/[id]?delete", { params: { lang, id }, data: { key } });
    } catch (error) {
      if (isVoidActionError(error) && error.status === 403) setWrong(true);
      else throw error;
    }
  };
  return (
    <section className="grid gap-3 rounded-xl border p-5 text-sm" data-testid="your-event">
      <p>
        <fbt desc="For whoever posted an event: keep this private link to delete it later">
          Only you have this link. Keep it to delete your event later.
        </fbt>
      </p>
      <input
        readOnly
        dir="ltr"
        value={link}
        onFocus={(e) => e.target.select()}
        className="w-full rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs"
        aria-label={String(
          fbs("Your private link", "Label of the private link to delete an event"),
        )}
        data-testid="delete-link"
      />
      {sure ? (
        <Button variant="destructive" onClick={remove} data-testid="delete-sure">
          <fbt desc="Button: really delete the event, after asking">Delete it for good</fbt>
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setSure(true)} data-testid="delete">
          <fbt desc="Button: delete the event you posted">Delete this event</fbt>
        </Button>
      )}
      {wrong && (
        <p className="text-destructive" data-testid="delete-wrong">
          <fbt desc="Error: the private link's key doesn't match this event">
            This link's key isn't this event's.
          </fbt>
        </p>
      )}
    </section>
  );
}

export default function Event({ event, text, left, deletable }: Props) {
  const { locale } = useLocale();
  // The browser's zone once known (null before); nothing has been typed into the form yet.
  const zone = useTimeZone();
  const seatsLeft = useLiveEvent(event.id, left);
  // In the page's language where a translation is stored (the sample events); else as written.
  // Marked with its own language and direction (langAttrs), whichever it's in.
  const shown = text ?? event;
  const textLang = text ? text.locale : event.locale;
  const written = new Intl.DisplayNames(locale, { type: "language" }).of(event.locale);
  return (
    // Three parts: the event, booking, and the stored record. On a phone they stack in that order;
    // from 1024px booking is a column of its own beside the other two.
    <article className="grid gap-10 pb-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-14 lg:pb-0">
      <div className="grid min-w-0 content-start gap-8 lg:col-start-1 lg:row-start-1">
        <div className="grid gap-4">
          <EventsCrumbs lang={textLang}>{shown.title}</EventsCrumbs>
          <h1
            className="text-3xl font-medium text-balance md:text-4xl"
            {...langAttrs(textLang)}
            data-testid="event-title"
          >
            {shown.title}
          </h1>
          {event.venue && (
            <p className="flex items-center gap-2 text-muted-foreground" data-testid="event-venue">
              <MapPin aria-hidden className="size-4 shrink-0 text-brand" />
              <fbt desc="Where an event happens, as its organiser wrote it">
                Where:{" "}
                <fbt:param name="venue">
                  <bdi {...langAttrs(event.locale)}>{event.venue}</bdi>
                </fbt:param>
              </fbt>
            </p>
          )}
        </div>
        <div className="flex items-center gap-5 border-y py-5">
          <DateTile startsAt={event.starts_at} />
          <EventTime
            startsAt={event.starts_at}
            className="gap-1.5 text-sm [&>:first-child]:text-base [&>:first-child]:font-medium md:[&>:first-child]:text-lg"
          />
        </div>
        <div className="grid gap-4">
          <p
            className="max-w-prose text-lg leading-relaxed text-pretty"
            {...langAttrs(textLang)}
            data-testid="event-description"
          >
            {shown.description}
          </p>
          {text && (
            <details className="text-muted-foreground text-sm">
              <summary
                className="cursor-pointer hover:text-foreground"
                data-testid="event-translated"
              >
                <fbt desc="Note under an event: its text was machine-translated from this language">
                  Translated by machine from{" "}
                  <fbt:param name="language">
                    <Formatted>{written!}</Formatted>
                  </fbt:param>
                </fbt>
              </summary>
              <div
                className="mt-3 grid gap-1 border-s-1 ps-4"
                {...langAttrs(event.locale)}
                data-testid="event-original"
              >
                <strong className="text-foreground">{event.title}</strong>
                <p>{event.description}</p>
              </div>
            </details>
          )}
          {!text && event.locale !== locale && (
            <p className="text-muted-foreground text-sm" data-testid="event-written-in">
              <fbt desc="Note under an event shown as its poster wrote it, in another language">
                Written in{" "}
                <fbt:param name="language">
                  <Formatted>{written!}</Formatted>
                </fbt:param>.
              </fbt>
            </p>
          )}
        </div>
      </div>
      <aside
        id="book"
        className="grid scroll-mt-24 content-start gap-8 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
      >
        <section className="grid gap-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">
              <fbt desc="Heading of the booking box on an event's page">Book a seat</fbt>
            </h2>
            <Flap value={seatsLeft} tone={seatsLeft ? "default" : "out"} data-testid="seats-left">
              {seatsLeft ? (
                <fbt desc="How many seats an event has left">
                  <fbt:plural count={seatsLeft} many="seats left" showCount="yes">
                    seat left
                  </fbt:plural>
                </fbt>
              ) : (
                <fbt desc="Badge: an event has no seats left">Sold out</fbt>
              )}
            </Flap>
          </div>
          <Book key={zone} id={event.id} zone={zone} soldOut={seatsLeft === 0} />
        </section>
        {deletable && <YourEvent id={event.id} />}
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <Stored event={event} />
      </div>
    </article>
  );
}
