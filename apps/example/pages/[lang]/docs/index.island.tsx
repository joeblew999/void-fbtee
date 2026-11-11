// The docs index for one language: void-fbtee's docs, as markdown pages under /<locale>/docs/
// (Void's @void/md pages list). English is the original; the other languages are translations.
import { fbt } from "fbtee";
import pages from "@void/md/pages";
import { useLocale } from "void-fbtee/react";
import Nav from "../../../components/Nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocsIndex() {
  const { locale } = useLocale();
  const docs = pages.filter((p) => p.path.startsWith(`/${locale}/docs/`));
  return (
    <main>
      <Nav page="/docs" />
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl" data-testid="docs-title">
            <fbt desc="Docs index heading">Documentation</fbt>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 ps-6" data-testid="docs-pages">
            {docs.map((p) => (
              <li key={p.path}>
                <a className="underline-offset-4 hover:underline" href={p.path}>
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
