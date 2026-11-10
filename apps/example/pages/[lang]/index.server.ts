import { defineHandler, defer } from "void";
import type { InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  return {
    count: 3,
    // Resolves after the shell has been sent, so it renders after next() returned.
    late: defer(async () => {
      await new Promise((r) => setTimeout(r, 300));
      return { count: 1 };
    }),
  };
});
