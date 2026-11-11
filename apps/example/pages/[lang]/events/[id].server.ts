// One event, by its id.
import { events } from "@schema";
import { defineHandler, type InferProps } from "void";
import { db, eq } from "void/db";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, c.req.param("id")!));
  if (!event) return c.notFound();
  return { event };
});
