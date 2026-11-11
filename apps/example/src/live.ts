// Live seat counts: each event page subscribes to its event's topic, and booking publishes the
// new count there (Void's live streams, on Durable Objects inside Void). Seat counts are public,
// so visitors needn't sign in, but only event topics can be read.
import { defineLiveStream } from "void/live";

export const live = defineLiveStream({
  id: "app",
  allowAnonymousControl: true,
  onSubscribe(ctx) {
    if (/^event:[0-9a-f-]{36}$/.test(ctx.topic)) return;
    return new Response("Forbidden", { status: 403 });
  },
});

/** The topic for one event's seat count. */
export const eventTopic = (id: string) => `event:${id}`;
