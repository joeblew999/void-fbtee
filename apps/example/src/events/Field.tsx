// One field of the events forms (posting an event, booking a seat): its label, the control, an
// optional line under it, and its error when the form has one, which the browser tests find by
// data-testid="error-<name>".
import type { ReactNode } from "react";
import { Label } from "@/ui/label";
import { cn } from "@/ui/utils";

export function Field({
  id,
  name,
  label,
  error,
  hint,
  className,
  children,
}: {
  /** The control's id, which the label points to. */
  id: string;
  /** The form field's name, for the error's data-testid. */
  name: string;
  label: ReactNode;
  /** Shown when set: the form's error for this field, in words. */
  error?: ReactNode;
  /** A line under the control. */
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint}
      {error && (
        <p className="text-destructive text-sm" data-testid={`error-${name}`}>
          {error}
        </p>
      )}
    </div>
  );
}
