// The site footer, in the root layout: what the example is made with.
import { fbt, list } from "fbtee";
import { Separator } from "@/components/ui/separator";

// The tools' names, each in Unicode isolate marks (FSI … PDI): in a right-to-left sentence, a name
// like "Vite+" keeps its "+" at its own end instead of the sentence's. Joined by fbtee's list(),
// the language's own way.
const TOOLS = ["Void", "Vite+", "fbtee", "Temporal", "shadcn/ui"].map((t) => `⁨${t}⁩`);
// oxlint-disable-next-line no-base-to-string
const tools = () => String(list(TOOLS));

export default function SiteFooter() {
  return (
    <footer className="mt-12">
      <Separator />
      <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
        <fbt desc="Footer: the tools this example is built with; tools is a list of their names">
          Built with <fbt:param name="tools">{tools()}</fbt:param>.
        </fbt>
      </p>
    </footer>
  );
}
