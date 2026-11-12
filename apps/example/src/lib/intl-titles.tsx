// The Intl page's section titles, translated: its headings, and its "On this page"
// (src/components/PageSections.tsx).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import type { SectionId } from "./intl";

export function sectionTitle(id: SectionId): ReactNode {
  switch (id) {
    case "dates":
      return <fbt desc="Intl page section: dates and times">Dates and times</fbt>;
    case "zones":
      return <fbt desc="Intl page section: named time zones">Time zones</fbt>;
    case "ranges":
      return <fbt desc="Intl page section: date ranges">Date ranges</fbt>;
    case "relative":
      return <fbt desc="Intl page section: relative time, like 'yesterday'">Relative time</fbt>;
    case "numbers":
      return <fbt desc="Intl page section: numbers">Numbers</fbt>;
    case "currency":
      return <fbt desc="Intl page section: money">Currency</fbt>;
    case "units":
      return <fbt desc="Intl page section: units of measure">Units</fbt>;
    case "plurals":
      return <fbt desc="Intl page section: plural rules">Plural rules</fbt>;
    case "lists":
      return <fbt desc="Intl page section: lists of items">Lists</fbt>;
    case "durations":
      return <fbt desc="Intl page section: lengths of time">Durations</fbt>;
    case "names":
      return <fbt desc="Intl page section: names of languages, regions and currencies">Names</fbt>;
    case "collation":
      return <fbt desc="Intl page section: sorting text">Sorting</fbt>;
    case "segments":
      return (
        <fbt desc="Intl page section: splitting text into characters, words and sentences">
          Splitting text
        </fbt>
      );
    case "locale":
      return <fbt desc="Intl page section: facts about this page's language">This language</fbt>;
    case "supported":
      return <fbt desc="Intl page section: everything this Intl supports">Supported values</fbt>;
    case "strings":
      return (
        <fbt desc="Intl page section: translated strings with fbtee">
          Translated strings (fbtee)
        </fbt>
      );
  }
}
