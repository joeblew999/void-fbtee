// Marketing page in islands mode: static HTML, only <Signup> hydrates.
import { fbt } from "fbtee";
import { useLocale } from "void-fbtee/react";
import { Temporal } from "temporal-polyfill";
import Nav from "../../../components/Nav";
import Signup from "./_Signup" with { island: "load" };
import Countdown from "./_Countdown" with { island: "visible" };

const launch = Temporal.ZonedDateTime.from("2026-12-24T19:30:00+07:00[Asia/Bangkok]");

export default function About() {
  const { locale } = useLocale();
  return (
    <main>
      <Nav page="/about" />
      <h1 data-testid="about-title">
        <fbt desc="Marketing page heading">Book a table in seconds</fbt>
      </h1>
      <p data-testid="about-static-date">
        {launch.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })}
      </p>
      <Signup seats={4} />
      <Countdown launch={launch.toString()} />
    </main>
  );
}
