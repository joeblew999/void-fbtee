// shadcn's DirectionProvider, set from the page's language (void-fbtee's useLocale): menus,
// popovers and sliders open the right way in Arabic. The layout wraps every page in it; an island
// hydrates without the layout, so an island that uses such components wraps itself too.
import type { ReactNode } from "react";
import { useLocale } from "void-fbtee/react";
import { DirectionProvider } from "@/components/ui/direction";

export default function LocaleDirection({ children }: { children: ReactNode }) {
  const { dir } = useLocale();
  return <DirectionProvider direction={dir}>{children}</DirectionProvider>;
}
