// A value in a Markdown page, formatted with Intl in the reader's language (and zone): pages import
// it as an island and pass the value as text, the same in every language's copy.
//   <Fmt num="1234567.891" />                       1,234,567.891 · ١٬٢٣٤٬٥٦٧٫٨٩١
//   <Fmt money="1299" currency="THB" />             THB 1,299.00 · ฿1,299.00
//   <Fmt when="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />   on that place's clock
//   <Fmt yours="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />  on the reader's clock
//   <Fmt ago="2027-03-06T18:30:00+07:00[Asia/Bangkok]" />    "in 115 days", from now
//   <Fmt langs="en-US,ar-EG,th-TH" />               each language named in the reader's
// The span carries the kind and value, so a test can check every one on every page.
import { useLocale, useNow, useTimeZone } from "void-fbtee/react";
import { fmt, type FmtProps } from "@/lib/fmt";

export default function Fmt(props: FmtProps) {
  const { locale } = useLocale();
  const zone = useTimeZone();
  const now = useNow();
  return (
    <span data-fmt={JSON.stringify(props)} className="font-medium">
      {fmt(props, locale, zone, now.toString())}
    </span>
  );
}
