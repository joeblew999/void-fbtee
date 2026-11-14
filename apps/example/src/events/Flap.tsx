// The events board's one signature: a value set in a split-flap chip, like a departure board's
// tile, with a hairline across its middle. The page shows still; when the value changes later
// (seats going as people book, live), the chip turns over once. Works with any script's digits;
// the turn is skipped when the reader asks for less motion (pages/style.css).
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { fbt } from "fbtee";
import { cn } from "@/ui/utils";

export function Flap({
  value,
  tone = "default",
  size = "md",
  className,
  ...props
}: ComponentProps<"span"> & {
  /** What the chip shows, compared between renders: a change turns it over. */
  value: string | number;
  tone?: "default" | "out";
  size?: "md" | "lg";
}) {
  const shown = useRef(value);
  // Two names for the same turn, swapped on each change, so the browser plays it again.
  const [turn, setTurn] = useState<"a" | "b" | undefined>();
  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    setTurn((t) => (t === "a" ? "b" : "a"));
  }, [value]);
  return (
    <span
      data-turn={turn}
      className={cn(
        "flap",
        size === "lg" ? "flap-lg" : "flap-md",
        tone === "out" && "flap-out",
        className,
      )}
      {...props}
    />
  );
}

/** Seats left in a flap, on the board and each event's page; "Sold out" when none. */
export function SeatsLeft({ left, ...props }: ComponentProps<"span"> & { left: number }) {
  return (
    <Flap value={left} tone={left ? "default" : "out"} {...props}>
      {left ? (
        <fbt desc="How many seats an event has left">
          <fbt:plural count={left} many="seats left" showCount="yes">
            seat left
          </fbt:plural>
        </fbt>
      ) : (
        <fbt common>Sold out</fbt>
      )}
    </Flap>
  );
}
