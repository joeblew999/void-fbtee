// The site footer, in the root layout: what the example is made with.
import { fbt } from "fbtee";
import { Separator } from "@/components/ui/separator";

export default function SiteFooter() {
  return (
    <footer className="mt-12">
      <Separator />
      <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <fbt desc="Footer: the tools this example is built with (names, not translated)">
          Built with Void, Vite+, fbtee, Temporal and shadcn/ui.
        </fbt>
      </p>
    </footer>
  );
}
