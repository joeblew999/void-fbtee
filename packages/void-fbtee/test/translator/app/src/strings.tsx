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
  <fbt desc="The opening of the email that brings a person their ticket for an event, attached to the email as a file; {name} is the person's name">
    Hello <fbt:param name="name">{name}</fbt:param>, your ticket is attached.
  </fbt>
);

/** Two placeholders. */
export const progress = (translated: number, total: number) => (
  <fbt desc="Progress line on the docs page: {translated} is how many of the app's strings are translated, {total} how many strings there are">
    <fbt:param name="translated">{translated}</fbt:param> of{" "}
    <fbt:param name="total">{total}</fbt:param> strings translated
  </fbt>
);

/** A count: one line per plural form each language uses. */
export const seats = (left: number) => (
  <fbt desc="How many seats at an event are still free to book; {number} is the count">
    <fbt:plural count={left} many="seats left" showCount="yes">
      seat left
    </fbt:plural>
  </fbt>
);

/** A command. */
export const run = () => (
  <fbt desc="Docs line: the command to run to start the app's development server; vp dev is the command">
    Run vp dev to start the app.
  </fbt>
);

/** A file name. */
export const agents = () => (
  <fbt desc="Docs line: the app's file AGENTS.md holds the instructions for the reader's coding agent, an AI program that writes code">
    The app's AGENTS.md tells your coding agent what to do.
  </fbt>
);

/** A product name. */
export const tools = () => (
  <fbt desc="Docs line: which tools translate the app's new text; Void's AI and Claude Code are product names">
    Void's AI or Claude Code translates what's new.
  </fbt>
);

/** A path. */
export const where = () => (
  <fbt desc="Docs line: the folder where each language's catalog, its file of translations, is kept">
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
  <fbt desc="A question asking the reader which page to open; {pages} is the names of the site's pages, joined as an 'or' list">
    Open <fbt:list conjunction="or" items={items} name="pages" />?
  </fbt>
);

/** A choice from a fixed set: one line per choice. */
export const takesPart = (name: string, way: "there" | "online") => (
  <fbt desc="How someone attends an event, in person at the venue or online over the internet, chosen from a fixed set; {name} is the person's name">
    <fbt:param name="name">{name}</fbt:param> takes part{" "}
    <fbt:enum enum-range={{ there: "in person", online: "online" }} value={way} />.
  </fbt>
);

/** A name with its gender: one line per gender. */
export const booked = (name: string, gender: IntlVariations) => (
  <fbt desc="Someone booked a seat at an event, worded by their gender; {name} is their name">
    <fbt:name name="name" gender={gender}>
      {name}
    </fbt:name>{" "}
    booked a seat.
  </fbt>
);

/** A pronoun by gender: one line per pronoun. */
export const checked = (name: string, gender: GenderConst) => (
  <fbt desc="Someone looked over their own ticket for an event, with a pronoun by their gender; {name} is their name">
    <fbt:param name="name">{name}</fbt:param> checked{" "}
    <fbt:pronoun type="possessive" gender={gender} human={true} /> ticket.
  </fbt>
);

/** The same value twice in one sentence. */
export const twice = (name: string) => (
  <fbt desc="The same person named twice: they booked a seat at an event, and they got its ticket by email; {name} is their name">
    <fbt:param name="name">{name}</fbt:param> booked, and <fbt:same-param name="name" /> got the
    ticket by email.
  </fbt>
);

/** Said to the reader, worded by their gender (`subject`): one line per gender. */
export const youreBooked = (gender: IntlVariations) => (
  <fbt
    desc="Said to the reader right after they book a seat at an event, and it means: you have a seat now. Short, like the English. Worded by the reader's gender"
    subject={gender}
  >
    You're booked.
  </fbt>
);

/** A person and a count in one sentence: one line per gender and plural form. */
export const bookedSeats = (who: string, gender: IntlVariations, seats: number) => (
  <fbt desc="Someone booked seats at an event, worded by their gender and the count; {who} is their name, {seats} how many seats">
    <fbt:param name="who" gender={gender}>
      {who}
    </fbt:param>{" "}
    booked{" "}
    <fbt:param name="seats" number={seats}>
      {seats}
    </fbt:param>{" "}
    seats.
  </fbt>
);
