// SPIKE: Cloudflare's `temporal` compatibility flag: does native Temporal exist in workerd,
// does its clock match Date.now(), and does it format exactly like the polyfill?
import { defineHandler } from "void";
import { Temporal as Poly } from "temporal-polyfill/implementation";

const values = (T: typeof Poly, locale: string) => ({
  booking: T.ZonedDateTime.from("2026-12-24T19:30:00+07:00[Asia/Bangkok]").toLocaleString(locale, {
    dateStyle: "full",
    timeStyle: "short",
  }),
  birthday: T.PlainDate.from("2026-04-15").toLocaleString(locale, { dateStyle: "long" }),
  dst: T.ZonedDateTime.from("2026-04-15T09:00:00[America/Los_Angeles]").offset,
  instant: T.Instant.from("2026-07-01T00:00:00Z").toZonedDateTimeISO("Europe/Berlin").toString(),
});

export const GET = defineHandler(async () => {
  const N = (globalThis as { Temporal?: typeof Poly }).Temporal;
  if (!N) return { native: false };
  const before = { temporal: N.Now.instant().epochMilliseconds, date: Date.now() };
  await new Promise((r) => setTimeout(r, 50));
  const after = { temporal: N.Now.instant().epochMilliseconds, date: Date.now() };
  const locales = ["th-TH", "de-DE", "ar-EG", "pl-PL"];
  const diffs = locales.flatMap((l) => {
    const n = values(N, l),
      p = values(Poly, l);
    return Object.keys(n)
      .filter((k) => n[k as keyof typeof n] !== p[k as keyof typeof p])
      .map(
        (k) =>
          `${l}.${k}: native "${n[k as keyof typeof n]}" vs polyfill "${p[k as keyof typeof p]}"`,
      );
  });
  return { native: true, clock: { before, after }, sample: values(N, "th-TH"), diffs };
});
