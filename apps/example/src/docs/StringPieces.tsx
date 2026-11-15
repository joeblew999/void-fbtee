// The Strings page's "Every piece of fbtee" section: each of fbtee's ways of writing a sentence, at
// work in the page's language, with the line that does it, all driven by one form, as fbtee's own
// example does (github.com/nkzw-tech/fbtee, example/src/example/Example.tsx): type a name, pick
// a gender, a count, how they take part and "and" or "or", and every sentence follows, worded by
// the language's own rules. The reader's sentence goes through <InLanguage> (fbtee's scoped
// runtimes), which also shows it in the site's other languages.
import { fbs, fbt, GenderConst, IntlVariations, useFbt } from "fbtee";
import { useState, type ReactNode } from "react";
import { InLanguage, useLocale, useLocales } from "void-fbtee/react";

type Gender = "female" | "male" | "unknown";
type Way = "there" | "online";

/** The form's choices, each in fbtee's own constant for the piece that takes it. */
const NAME_GENDER = {
  female: IntlVariations.GENDER_FEMALE,
  male: IntlVariations.GENDER_MALE,
  unknown: IntlVariations.GENDER_UNKNOWN,
} as const;
const PRONOUN = {
  female: GenderConst.FEMALE_SINGULAR,
  male: GenderConst.MALE_SINGULAR,
  unknown: GenderConst.UNKNOWN_SINGULAR,
} as const;

/** The menu's three words, fbtee's common strings, as the items of a list inside a sentence. */
function ListInSentence({ or }: { or: boolean }) {
  const items = [fbs.c("Home"), fbs.c("Events"), fbs.c("Docs")];
  return or ? (
    <fbt desc="Strings page: a question asking the reader which page to open; {pages} is the names of the site's menu pages, joined as an 'or' list">
      Open <fbt:list conjunction="or" items={items} name="pages" />?
    </fbt>
  ) : (
    <fbt desc="Strings page: what the site's menu holds; {pages} is the names of its pages, joined as an 'and' list">
      The menu has <fbt:list items={items} name="pages" />.
    </fbt>
  );
}

function Enum({ name, way }: { name: string; way: Way }) {
  return (
    <fbt desc="Strings page: how someone attends an event, in person at the venue or online over the internet, chosen from a fixed set; {name} is the person's name">
      <fbt:param name="name">{name}</fbt:param> takes part{" "}
      <fbt:enum enum-range={{ there: "in person", online: "online" }} value={way} />.
    </fbt>
  );
}

function Name({ name, gender }: { name: string; gender: IntlVariations }) {
  return (
    <fbt desc="Strings page: someone booked a seat at an event, worded by their gender; {name} is their name">
      <fbt:name name="name" gender={gender}>
        {name}
      </fbt:name>{" "}
      booked a seat.
    </fbt>
  );
}

function Seats({ name, count }: { name: string; count: number }) {
  return (
    <fbt desc="Strings page: someone booked seats at an event; {name} is their name, {number} how many seats">
      <fbt:param name="name">{name}</fbt:param> booked{" "}
      <fbt:plural count={count} many="seats" showCount="ifMany">
        a seat
      </fbt:plural>.
    </fbt>
  );
}

function Pronoun({ name, gender }: { name: string; gender: GenderConst }) {
  return (
    <fbt desc="Strings page: someone looked over their own ticket for an event, with a pronoun by their gender; {name} is their name">
      <fbt:param name="name">{name}</fbt:param> checked{" "}
      <fbt:pronoun type="possessive" gender={gender} human={true} /> ticket.
    </fbt>
  );
}

function SameParam({ name }: { name: string }) {
  return (
    <fbt desc="Strings page: the same person named twice: they booked a seat at an event, and they got its ticket by email; {name} is their name">
      <fbt:param name="name">{name}</fbt:param> booked, and <fbt:same-param name="name" /> got the
      ticket by email.
    </fbt>
  );
}

/**
 * Addressed to the reader, worded by their gender: fbtee's `subject`, so the code says the sentence
 * varies by it and the catalog gets a line per gender on its own (the dev server's prepare). Inside
 * <InLanguage>, in that runtime's language.
 */
function ForTheReader({ gender }: { gender: Gender }) {
  const { fbt } = useFbt();
  return (
    <fbt
      desc="Strings page: said to the reader right after they book a seat at an event, and it means: you have a seat now. Short, like the English"
      subject={NAME_GENDER[gender]}
    >
      You're booked.
    </fbt>
  );
}

function Piece({
  id,
  title,
  code,
  children,
}: {
  id: string;
  title: ReactNode;
  code: string;
  children: ReactNode;
}) {
  return (
    <div data-piece={id} className="space-y-2">
      <h3 className="text-lg font-medium">{title}</h3>
      <div className="space-y-1" data-testid={`piece-${id}`}>
        {children}
      </div>
      <div dir="ltr" className="rounded-md bg-muted p-3 font-mono text-xs break-all">
        <code>{code}</code>
      </div>
    </div>
  );
}

const field = "flex flex-col gap-1 text-sm";
const input = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function StringPieces() {
  const { locale } = useLocale();
  const others = useLocales().filter((l) => l.locale !== locale);
  const [name, setName] = useState("Laila");
  const [gender, setGender] = useState<Gender>("female");
  const [count, setCount] = useState(3);
  const [way, setWay] = useState<Way>("there");
  const [or, setOr] = useState(false);
  // What people type is theirs: the name is shown as typed, whatever the page's language.
  const who = name.trim() || "Laila";
  return (
    <>
      <form
        className="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-5"
        data-testid="pieces-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className={field}>
          <fbt desc="Strings page form: a person's name">Name</fbt>
          <input
            className={input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="try-name"
          />
        </label>
        <label className={field}>
          <fbt desc="Strings page form: the person's gender">Gender</fbt>
          <select
            className={input}
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
            data-testid="try-gender"
          >
            <option value="female">{fbs("Female", "Strings page form: female gender")}</option>
            <option value="male">{fbs("Male", "Strings page form: male gender")}</option>
            <option value="unknown">
              {fbs("Not said", "Strings page form: gender not given")}
            </option>
          </select>
        </label>
        <label className={field}>
          <fbt common>Seats</fbt>
          <input
            className={input}
            type="number"
            min={0}
            value={count}
            onChange={(event) => setCount(Math.max(0, Number(event.target.value) || 0))}
            data-testid="try-count"
          />
        </label>
        <label className={field}>
          <fbt desc="Strings page form: how the person takes part in the event">Takes part</fbt>
          <select
            className={input}
            value={way}
            onChange={(event) => setWay(event.target.value as Way)}
            data-testid="try-way"
          >
            <option value="there">
              {fbs("In person", "Strings page form: taking part in person")}
            </option>
            <option value="online">{fbs("Online", "Strings page form: taking part online")}</option>
          </select>
        </label>
        <label className={field}>
          <fbt desc="Strings page form: whether the list joins its items with 'and' or 'or'">
            List
          </fbt>
          <select
            className={input}
            value={or ? "or" : "and"}
            onChange={(event) => setOr(event.target.value === "or")}
            data-testid="try-conjunction"
          >
            <option value="and">{fbs("and", "Strings page form: a list joined with 'and'")}</option>
            <option value="or">{fbs("or", "Strings page form: a list joined with 'or'")}</option>
          </select>
        </label>
      </form>
      <Piece
        id="list"
        title={
          <fbt desc="Strings page piece title: a list inside a sentence">A list in a sentence</fbt>
        }
        code={'<fbt:list conjunction="or" items={items} name="pages" />'}
      >
        <p>
          <ListInSentence or={or} />
        </p>
      </Piece>
      <Piece
        id="enum"
        title={
          <fbt desc="Strings page piece title: a choice from a fixed set">A choice from a set</fbt>
        }
        code={'<fbt:enum enum-range={{ there: "in person", online: "online" }} value={way} />'}
      >
        <p>
          <Enum name={who} way={way} />
        </p>
      </Piece>
      <Piece
        id="name"
        title={
          <fbt desc="Strings page piece title: a person's name, with their gender">
            A name and its gender
          </fbt>
        }
        code={'<fbt:name name="name" gender={gender}>{name}</fbt:name>'}
      >
        <p>
          <Name name={who} gender={NAME_GENDER[gender]} />
        </p>
      </Piece>
      <Piece
        id="plural"
        title={
          <fbt desc="Strings page piece title: a count, each language's plural forms">A count</fbt>
        }
        code={'<fbt:plural count={count} many="seats" showCount="ifMany">a seat</fbt:plural>'}
      >
        <p>
          <Seats name={who} count={count} />
        </p>
      </Piece>
      <Piece
        id="pronoun"
        title={<fbt desc="Strings page piece title: a pronoun by gender">A pronoun</fbt>}
        code={'<fbt:pronoun type="possessive" gender={gender} human={true} />'}
      >
        <p>
          <Pronoun name={who} gender={PRONOUN[gender]} />
        </p>
      </Piece>
      <Piece
        id="same-param"
        title={
          <fbt desc="Strings page piece title: the same value twice in a sentence">
            The same value twice
          </fbt>
        }
        code={'<fbt:same-param name="name" />'}
      >
        <p>
          <SameParam name={who} />
        </p>
      </Piece>
      <Piece
        id="reader"
        title={
          <fbt desc="Strings page piece title: a sentence for the reader, by the reader's gender">
            For the reader, by their gender
          </fbt>
        }
        code={'<fbt desc="…" subject={gender}>You\'re booked.</fbt>'}
      >
        <p data-gender={gender}>
          <InLanguage locale={locale} gender={gender}>
            <ForTheReader gender={gender} />
          </InLanguage>
        </p>
      </Piece>
      <Piece
        id="in-language"
        title={
          <fbt desc="Strings page piece title: part of the page in another language">
            Part of the page in another language
          </fbt>
        }
        code={"<InLanguage locale={other.locale} gender={gender}>…</InLanguage>"}
      >
        {others.map((other) => (
          <p key={other.locale} data-locale={other.locale}>
            <InLanguage locale={other.locale} gender={gender}>
              <ForTheReader gender={gender} />
            </InLanguage>
          </p>
        ))}
      </Piece>
    </>
  );
}
