// The Emails page, a reference: the app's own emails (src/events/emails.ts), made for a sample event
// in this page's language (the loader), shown as a mail app gets them, and what it takes for a
// translated email to arrive the right way round, each with the file and the code that does it.
// What's void-fbtee's (inLocale, langAttrs) and what's this app's (its look, in EmailLayout.tsx).
import type { ReactNode } from "react";
import { fbt } from "fbtee";
import { PageSections } from "@/docs/PageSections";
import type { Props } from "./emails.server";

type Shown = Props["booking"];

/** One email: its subject, its HTML as a mail app shows it, and its text version. */
function Preview({ id, name, email }: { id: string; name: ReactNode; email: Shown }) {
  return (
    <figure className="space-y-3" data-email={id}>
      <figcaption className="text-sm text-muted-foreground">{name}</figcaption>
      <p className="font-medium" data-testid={`${id}-subject`}>
        {email.subject}
      </p>
      {/* Sandboxed: the email's own HTML, with nothing of the page's. */}
      <iframe
        srcDoc={email.html}
        sandbox=""
        title={email.subject}
        className="h-[28rem] w-full rounded-lg border bg-[rgb(20,22,28)]"
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          <fbt desc="Emails page: shows the plain-text version sent with an email">
            The text version, sent with it
          </fbt>
        </summary>
        <pre className="mt-2 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{email.text}</pre>
      </details>
    </figure>
  );
}

/** One thing a translated email needs: what and why, and the code that does it, as in its file. */
interface Point {
  id: string;
  title: ReactNode;
  why: ReactNode;
  code: { file: string; line: string }[];
}

function points(): Point[] {
  return [
    {
      id: "language",
      title: (
        <fbt desc="Emails page point title: the email is in the recipient's language">
          In the recipient's language
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: void-fbtee's inLocale writes the email in the language saved with the booking">
          An email goes out from an action, a queue or a scheduled job, often caused by someone
          else: a cancellation reaches everyone booked, each in their own language. The language is
          saved with the booking, and void-fbtee's inLocale runs the email's code in it, its fbs
          strings and its dates included.
        </fbt>
      ),
      code: [
        { file: "src/events/emails.ts", line: "inLocale(booking.locale, ({ locale, dir }) => {" },
      ],
    },
    {
      id: "content",
      title: (
        <fbt desc="Emails page point title: the language and direction go on the email's content">
          Language and direction on the content
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: Gmail drops the html element, so lang and dir also go on the content's box">
          Gmail drops the email's html, head and body elements and keeps what's inside, so an Arabic
          email that says right to left only on html shows left to right. The content's own box says
          it too.
        </fbt>
      ),
      code: [{ file: "src/events/EmailLayout.tsx", line: "<Container lang={locale} dir={dir} …>" }],
    },
    {
      id: "defaults",
      title: (
        <fbt desc="Emails page point title: the email builder's defaults">
          The email builder's own defaults
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: React Email's Body says English, left to right, unless given the email's language">
          React Email, which this app builds its emails with, writes English, left to right around
          the content unless its Body is given the email's own language and direction.
        </fbt>
      ),
      code: [{ file: "src/events/EmailLayout.tsx", line: "<Body lang={locale} dir={dir} …>" }],
    },
    {
      id: "other-language",
      title: (
        <fbt desc="Emails page point title: text in another language than the email">
          Text in another language
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: an event's title in another language is marked with its own, as on the site's pages">
          An event's title is as its organiser wrote it, so it can be in another language than the
          email, as the Arabic title in the English and Thai emails here. It's marked with its own
          language and direction, with void-fbtee's langAttrs, as on the site's pages.
        </fbt>
      ),
      code: [
        {
          file: "src/events/emails.ts",
          line: "title: { text: event.title, ...langAttrs(event.titleLocale) },",
        },
        { file: "src/events/EmailLayout.tsx", line: "<bdi lang={title.lang} dir={title.dir}>" },
      ],
    },
    {
      id: "address",
      title: (
        <fbt desc="Emails page point title: a web address written out in the email">
          A written-out address
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: a web address in a right-to-left email is marked left to right">
          A web address is read left to right in every language. Written out in a right-to-left
          email, as the private link is, its parts come out reversed unless it's marked left to
          right.
        </fbt>
      ),
      code: [{ file: "src/events/EmailLayout.tsx", line: '<a href={link} dir="ltr" …>' }],
    },
    {
      id: "images",
      title: (
        <fbt desc="Emails page point title: images sent inside the email">
          Images inside the email
        </fbt>
      ),
      why: (
        <fbt desc="Emails page point: the logo is sent inside the email, so it shows in every mail app and in the dev inbox">
          The logo is sent inside the email, with Void's inline attachments, rather than linked: it
          shows in every mail app, and in development too, where the site's address is localhost.
        </fbt>
      ),
      code: [
        { file: "src/events/emails.ts", line: "attachments: [logoAttachment]," },
        {
          file: "src/events/EmailLayout.tsx",
          line: '<Img src="cid:logo" width="24" height="24" alt="" />',
        },
      ],
    },
  ];
}

export default function EmailsPage({ booking, link }: Props) {
  const all = points();
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium" data-testid="emails-title">
          <fbt desc="Docs page title: the page about the app's translated emails">Emails</fbt>
        </h1>
        <p className="text-muted-foreground">
          <fbt desc="Emails page introduction">
            This app emails people in their own language: a booking's confirmation, a reminder the
            day before, a cancellation, and the private link to delete an event. Here are two of
            them, made by the app's own code for a sample event, in this page's language, and what
            it takes for each to arrive the right way round.
          </fbt>
        </p>
      </div>
      <PageSections
        sections={[
          {
            id: "emails",
            title: <fbt desc="Emails page section title: the sample emails">Two of the emails</fbt>,
          },
          {
            id: "how",
            title: (
              <fbt desc="Emails page section title: what a translated email needs">
                What a translated email needs
              </fbt>
            ),
          },
        ]}
      />
      <section id="emails" className="scroll-mt-20 space-y-8 pt-6">
        <h2 className="border-b pb-2 text-2xl font-medium">
          <fbt desc="Emails page section title: the sample emails">Two of the emails</fbt>
        </h2>
        <Preview
          id="booking"
          email={booking}
          name={
            <fbt desc="Emails page: the sample booking confirmation email">
              A booking's confirmation
            </fbt>
          }
        />
        <Preview
          id="link"
          email={link}
          name={
            <fbt desc="Emails page: the sample email with the private link to delete an event">
              The private link, to whoever posted the event
            </fbt>
          }
        />
      </section>
      <section id="how" className="scroll-mt-20 space-y-6 pt-6">
        <h2 className="border-b pb-2 text-2xl font-medium">
          <fbt desc="Emails page section title: what a translated email needs">
            What a translated email needs
          </fbt>
        </h2>
        {all.map((p) => (
          <div key={p.id} id={p.id} data-point={p.id} className="space-y-2">
            <h3 className="text-lg font-medium">{p.title}</h3>
            <p className="text-pretty text-muted-foreground">{p.why}</p>
            <div dir="ltr" className="space-y-2 rounded-md bg-muted p-3 font-mono text-xs">
              {p.code.map((c) => (
                <div key={c.file + c.line}>
                  <div className="text-muted-foreground">{c.file}</div>
                  <code className="break-all">{c.line}</code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
