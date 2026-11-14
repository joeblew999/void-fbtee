// How a booking's PDF ticket looks: the booking email's look (the site's logo and name, its
// colours from pages/style.css through email-theme.ts, its system font), on one A5 page, printed
// by Cloudflare Browser Run (src/pdf.ts). Rendered with React Email, as the emails are, so its
// styles are inline and the page needs nothing else. The page carries its language and direction
// (<html lang dir>), and the event's title keeps its own inside the heading, as in the email.
import { Body, Head, Html, Img, Section, Tailwind, Text, render } from "react-email";
import { emailTheme } from "./email-theme";
import { logoDataUrl, titled, type EmailLook } from "./EmailLayout";

export type TicketLook = {
  locale: string;
  dir: string;
  /** The heading, with the event's title in it. */
  heading: string;
  title: EmailLook["title"];
  /** Label and value: who booked, when it starts. */
  rows: { label: string; value: string }[];
  /** What to do with the ticket. */
  note: string;
  /** The event's page, with the line that introduces it. */
  link: { label: string; url: string };
};

function TicketLayout({ locale, dir, heading, title, rows, note, link }: TicketLook) {
  return (
    <Html lang={locale} dir={dir}>
      <Tailwind config={emailTheme}>
        <Head>
          {/* One A5 page, edge to edge, all of it in the site's background (src/pdf.ts prints
              backgrounds): the page is the paper's size, and the body fills it. */}
          <style
            dangerouslySetInnerHTML={{
              __html: "@page { size: A5; margin: 0 } html, body { min-height: 100% }",
            }}
          />
        </Head>
        <Body
          lang={locale}
          dir={dir}
          className="bg-background text-foreground font-sans m-0 p-8 box-border min-h-full"
        >
          <Section className="bg-card text-card-foreground rounded-lg border border-solid border-border p-8">
            <Text className="m-0 mb-6 text-base font-semibold">
              <Img
                src={logoDataUrl}
                width="24"
                height="24"
                alt=""
                className="inline-block align-middle me-2"
              />
              void-fbtee
            </Text>
            <Text className="font-heading text-2xl font-semibold m-0 mb-6">
              {titled(heading, title)}
            </Text>
            {rows.map((row) => (
              <Section
                key={row.label}
                className="border-0 border-b border-solid border-border py-3"
              >
                <Text className="m-0 text-sm text-muted-foreground">{row.label}</Text>
                <Text className="m-0 text-base">{row.value}</Text>
              </Section>
            ))}
            <Text className="m-0 mt-6 text-base border-0 border-s-4 border-solid border-brand ps-3">
              {note}
            </Text>
            <Text className="m-0 mt-6 text-sm text-muted-foreground">{link.label}</Text>
            {/* An address reads left to right, on an Arabic ticket too. */}
            <Text className="m-0 text-sm break-all">
              <a href={link.url} dir="ltr" className="text-brand">
                {link.url}
              </a>
            </Text>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** The ticket's page of HTML, ready to print. */
export const ticketHtml = (look: TicketLook) => render(<TicketLayout {...look} />);
