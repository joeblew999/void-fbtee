// The Formats page's section titles, translated: its headings, and its "On this page" in the docs
// layout (components/DocsLayout.tsx).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import type { SectionId } from "./formats";

export function sectionTitle(id: SectionId): ReactNode {
  switch (id) {
    case "dates":
      return <fbt desc="Formats section: dates and times">Dates and times</fbt>;
    case "zones":
      return <fbt desc="Formats section: named time zones">Time zones</fbt>;
    case "ranges":
      return <fbt desc="Formats section: date ranges">Date ranges</fbt>;
    case "relative":
      return <fbt desc="Formats section: relative time, like 'yesterday'">Relative time</fbt>;
    case "numbers":
      return <fbt desc="Formats section: numbers">Numbers</fbt>;
    case "currency":
      return <fbt desc="Formats section: money">Currency</fbt>;
    case "units":
      return <fbt desc="Formats section: units of measure">Units</fbt>;
    case "plurals":
      return <fbt desc="Formats section: plural rules">Plural rules</fbt>;
    case "lists":
      return <fbt desc="Formats section: lists of items">Lists</fbt>;
    case "durations":
      return <fbt desc="Formats section: lengths of time">Durations</fbt>;
    case "names":
      return <fbt desc="Formats section: names of languages, regions and currencies">Names</fbt>;
    case "collation":
      return <fbt desc="Formats section: sorting text">Sorting</fbt>;
    case "segments":
      return (
        <fbt desc="Formats section: splitting text into characters, words and sentences">
          Splitting text
        </fbt>
      );
    case "locale":
      return <fbt desc="Formats section: facts about this page's language">This language</fbt>;
    case "supported":
      return <fbt desc="Formats section: everything this Intl supports">Supported values</fbt>;
    case "temporal":
      return <fbt desc="Formats section: dates with Temporal">Temporal</fbt>;
    case "strings":
      return (
        <fbt desc="Formats section: translated strings with fbtee">Translated strings (fbtee)</fbt>
      );
  }
}
