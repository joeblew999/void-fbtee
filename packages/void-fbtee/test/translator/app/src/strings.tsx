// The translator test's strings (e2e/translator/): what an app's catalog holds, each testing one
// thing a translation can get wrong. Each is a real fbtee string with its description, so fbtee's
// collect and prepare make the catalogs, as for any app. Add a string when Void's AI gets a new
// kind of thing wrong, and its translation to every catalog in i18n/translations/.
import { fbt, GenderConst, IntlVariations } from "fbtee";

/** A label. */
export const save = () => <fbt desc="Button that saves the event the person is editing">Save</fbt>;

/** A sentence. */
export const shows = () => (
  <fbt desc="Line under the form, telling the person what happens after they post">
    Your event shows in every language once it's posted.
  </fbt>
);

/** A placeholder. */
export const hello = (name: string) => (
  <fbt desc="Greeting at the top of an email, with the person's name">
    Hello <fbt:param name="name">{name}</fbt:param>, your ticket is attached.
  </fbt>
);

/** Two placeholders. */
export const progress = (translated: number, total: number) => (
  <fbt desc="Progress line on the docs page: how many strings are translated">
    <fbt:param name="translated">{translated}</fbt:param> of{" "}
    <fbt:param name="total">{total}</fbt:param> strings translated
  </fbt>
);

/** A count: one line per plural form each language uses. */
export const seats = (left: number) => (
  <fbt desc="How many seats are left at an event">
    <fbt:plural count={left} many="seats left" showCount="yes">
      seat left
    </fbt:plural>
  </fbt>
);

/** A command. */
export const run = () => (
  <fbt desc="Docs line saying which command to run to start the dev server">
    Run vp dev to start the app.
  </fbt>
);

/** A file name. */
export const agents = () => (
  <fbt desc="Docs line saying where the app's agent instructions are">
    The app's AGENTS.md tells your coding agent what to do.
  </fbt>
);

/** A product name. */
export const tools = () => (
  <fbt desc="Docs line saying which tools translate the app">
    Void's AI or Claude Code translates what's new.
  </fbt>
);

/** A path. */
export const where = () => (
  <fbt desc="Docs line saying where the catalogs are">
    Each language's catalog is in i18n/translations.
  </fbt>
);

/** A question. */
export const ready = () => (
  <fbt desc="Heading of the page's last section, asking whether the reader is ready">
    Ready to translate your app?
  </fbt>
);

/** The app's own terms (its common strings, vite.config.ts), used as headings. */
export const terms = () => (
  <>
    <fbt common>Strings</fbt>
    <fbt common>Catalog</fbt>
  </>
);

/** A list, "a, b or c" (fbtee joins it in each language's own words). */
export const open = (items: string[]) => (
  <fbt desc="Question asking which of the site's pages to open, its names as an 'or' list">
    Open <fbt:list conjunction="or" items={items} name="pages" />?
  </fbt>
);

/** A choice from a fixed set: one line per choice. */
export const takesPart = (name: string, way: "there" | "online") => (
  <fbt desc="How someone takes part in an event, chosen from a fixed set">
    <fbt:param name="name">{name}</fbt:param> takes part{" "}
    <fbt:enum enum-range={{ there: "in person", online: "online" }} value={way} />.
  </fbt>
);

/** A name with its gender: one line per gender. */
export const booked = (name: string, gender: IntlVariations) => (
  <fbt desc="Someone booked a seat, worded by their gender">
    <fbt:name name="name" gender={gender}>
      {name}
    </fbt:name>{" "}
    booked a seat.
  </fbt>
);

/** A pronoun by gender: one line per pronoun. */
export const checked = (name: string, gender: GenderConst) => (
  <fbt desc="Someone checked their own ticket, with a pronoun by their gender">
    <fbt:param name="name">{name}</fbt:param> checked{" "}
    <fbt:pronoun type="possessive" gender={gender} human={true} /> ticket.
  </fbt>
);

/** The same value twice in one sentence. */
export const twice = (name: string) => (
  <fbt desc="The same person's name twice in one sentence">
    <fbt:param name="name">{name}</fbt:param> booked, and <fbt:same-param name="name" /> got the
    ticket by email.
  </fbt>
);
