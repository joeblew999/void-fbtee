// Void's docs example of an action (guide/pages-routing/actions-and-forms.md), with a manual
// validator (guide/server-routing.md, "Manual validators"): Zod, which a developer installs. A
// missing name fails validation; the page shows Void's message for it (form.errors.name).
import { defineHandler } from "void";
import { z } from "zod";

export const action = defineHandler.withValidator({
  body: z.object({ name: z.string().min(1) }),
})(async () => {
  // No return: Void reruns the loader, as in the docs.
});
