// The events board's one signature: a value set in a split-flap chip, like a departure board's
// tile, with a hairline across its middle. The page shows still; when the value changes later
// (seats going as people book, live), the chip turns over once. Works with any script's digits;
// the turn is skipped when the reader asks for less motion (pages/style.css).
import { useEffect, useRef, useState, type ComponentProps } from "react";
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
