// The Strings page's "Every piece of fbtee" section: each of fbtee's ways of writing a sentence, at
// work in the page's language, with the line that does it. A list inside a sentence, a choice from
// a set, a person's name with their gender, a pronoun, the same value twice, and a sentence for
// the reader that follows the reader's own gender, shown for three readers through <InLanguage>
// (fbtee's scoped runtimes), which also shows the same line in the site's other languages.
import { fbs, fbt, GenderConst, IntlVariations, useFbt } from "fbtee";
import type { ReactNode } from "react";
import { InLanguage, useLocale, useLocales } from "void-fbtee/react";

/** The menu's three words, fbtee's common strings, as the items of a list inside a sentence. */
function ListInSentence() {
  const items = [fbs.c("Home"), fbs.c("Events"), fbs.c("Docs")];
  return (
    <fbt desc="Strings page: the site's menu, its words as a list inside the sentence">
      The menu has <fbt:list items={items} name="pages" />.
    </fbt>
  );
}

function Enum({ way }: { way: "there" | "online" }) {
  return (
    <fbt desc="Strings page: how someone takes part in an event, chosen from a fixed set">
      <fbt:param name="name">{"Somchai"}</fbt:param> takes part{" "}
      <fbt:enum enum-range={{ there: "in person", online: "online" }} value={way} />.
    </fbt>
  );
}

function Name({ name, gender }: { name: string; gender: IntlVariations }) {
  return (
    <fbt desc="Strings page: someone booked a seat, worded by their gender">
      <fbt:name name="name" gender={gender}>
        {name}
      </fbt:name>{" "}
      booked a seat.
    </fbt>
  );
}

function Pronoun({ gender }: { gender: GenderConst }) {
  return (
    <fbt desc="Strings page: someone checked their own ticket, with a pronoun by their gender">
      <fbt:param name="name">{"Laila"}</fbt:param> checked{" "}
      <fbt:pronoun type="possessive" gender={gender} human={true} /> ticket.
    </fbt>
  );
}

function SameParam() {
  return (
    <fbt desc="Strings page: the same name twice in one sentence">
      <fbt:param name="name">{"Laila"}</fbt:param> booked, and <fbt:same-param name="name" /> got
      the ticket by email.
    </fbt>
  );
}

/** Addressed to the reader: inside <InLanguage>, worded by that runtime's reader's gender. */
function ForTheReader() {
  const { fbt } = useFbt();
  return <fbt desc="Strings page: told to the reader who just booked">You're booked.</fbt>;
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

export function StringPieces() {
  const { locale } = useLocale();
  const others = useLocales().filter((l) => l.locale !== locale);
  return (
    <>
      <Piece
        id="list"
        title={
          <fbt desc="Strings page piece title: a list inside a sentence">A list in a sentence</fbt>
        }
        code={'<fbt:list items={items} name="pages" />'}
      >
        <p>
          <ListInSentence />
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
          <Enum way="there" />
        </p>
        <p>
          <Enum way="online" />
        </p>
      </Piece>
      <Piece
        id="name"
        title={
          <fbt desc="Strings page piece title: a person's name, with their gender">
            A name and its gender
          </fbt>
        }
        code={'<fbt:name name="name" gender={IntlVariations.GENDER_FEMALE}>{name}</fbt:name>'}
      >
        <p>
          <Name name="Laila" gender={IntlVariations.GENDER_FEMALE} />
        </p>
        <p>
          <Name name="Somchai" gender={IntlVariations.GENDER_MALE} />
        </p>
      </Piece>
      <Piece
        id="pronoun"
        title={<fbt desc="Strings page piece title: a pronoun by gender">A pronoun</fbt>}
        code={'<fbt:pronoun type="possessive" gender={GenderConst.FEMALE_SINGULAR} human={true} />'}
      >
        <p>
          <Pronoun gender={GenderConst.FEMALE_SINGULAR} />
        </p>
        <p>
          <Pronoun gender={GenderConst.UNKNOWN_SINGULAR} />
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
          <SameParam />
        </p>
      </Piece>
      <Piece
        id="reader"
        title={
          <fbt desc="Strings page piece title: a sentence for the reader, by the reader's gender">
            For the reader, by their gender
          </fbt>
        }
        code={'<InLanguage locale={locale} gender="female">…</InLanguage>'}
      >
        {(["male", "female", "unknown"] as const).map((gender) => (
          <p key={gender} data-gender={gender}>
            <InLanguage locale={locale} gender={gender}>
              <ForTheReader />
            </InLanguage>
          </p>
        ))}
      </Piece>
      <Piece
        id="in-language"
        title={
          <fbt desc="Strings page piece title: part of the page in another language">
            Part of the page in another language
          </fbt>
        }
        code={"<InLanguage locale={other.locale}>…</InLanguage>"}
      >
        {others.map((other) => (
          <p key={other.locale} data-locale={other.locale}>
            <InLanguage locale={other.locale}>
              <ForTheReader />
            </InLanguage>
          </p>
        ))}
      </Piece>
    </>
  );
}
