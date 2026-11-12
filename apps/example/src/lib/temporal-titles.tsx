// The Temporal page's section titles, translated: its headings, and its "On this page"
// (src/components/PageSections.tsx).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import type { TemporalSectionId } from "./temporal";

export function temporalTitle(id: TemporalSectionId): ReactNode {
  switch (id) {
    case "instants":
      return <fbt desc="Temporal section: exact moments in time, in UTC">Instants</fbt>;
    case "zones":
      return <fbt desc="Temporal section: one moment in different time zones">Time zones</fbt>;
    case "clock-changes":
      return (
        <fbt desc="Temporal section: daylight saving, when clocks go forward or back">
          Clock changes
        </fbt>
      );
    case "calendar":
      return <fbt desc="Temporal section: dates, months, weeks and comparing">Calendar dates</fbt>;
    case "durations":
      return <fbt desc="Temporal section: lengths of time between dates">Durations</fbt>;
  }
}
