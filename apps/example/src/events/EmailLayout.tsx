// How the events' emails look (src/events/emails.ts makes their words): the site's logo and name,
// as in its header, the subject as the heading, the email's lines, and its link, as a button under
// the line that introduced it, or shown whole in a box when the link is the thing to keep (the
// private link). Rendered with React Email (react.email): tables and inline styles, the HTML mail
// apps show, in the site's own look (email-theme.ts). The event's title keeps its own language and
// direction inside each line, as on the site.
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  render,
} from "react-email";
import type { ReactNode } from "react";
import { emailTheme } from "./email-theme";
// The site's icon, made from public/favicon.svg (`vp run icons`): a PNG, as mail apps don't show SVG.
import logoUrl from "../../public/pwa-192x192.png?inline";

/** The logo as a data: URL, for a page that carries it inside (the PDF ticket: TicketLayout.tsx). */
export const logoDataUrl = logoUrl;

/**
 * The logo, sent inside each email (Void's inline attachments, guide/email/sending.md) and shown
 * from there (`cid:logo`): no link out, so it shows in dev's inbox too, where the site is localhost.
 */
export const logoAttachment = {
  filename: "logo.png",
  content: Uint8Array.from(atob(logoUrl.slice(logoUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0)),
  contentType: "image/png",
  contentId: "logo",
  disposition: "inline" as const,
};

export type EmailLook = {
  locale: string;
  dir: string;
  subject: string;
  /** The email's lines, the event's title in them as written. */
  lines: string[];
  /** The email's link; under a button with this label, or shown whole when there's none. */
  link: string;
  label?: string;
  /** The event's title, and its own language and direction, to mark it inside the lines. */
  title: { text: string; lang: string; dir: string };
};

/** A line with the event's title in it marked in its own language and direction (the PDF ticket's
 * heading too: TicketLayout.tsx). */
export function titled(line: string, title: EmailLook["title"]): ReactNode {
  const at = line.indexOf(title.text);
  if (at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <bdi lang={title.lang} dir={title.dir}>
        {title.text}
      </bdi>
      {line.slice(at + title.text.length)}
    </>
  );
}

function EmailLayout({ locale, dir, subject, lines, link, label, title }: EmailLook) {
  return (
    <Html lang={locale} dir={dir}>
      <Tailwind config={emailTheme}>
        <Head />
        <Preview>{subject}</Preview>
        {/* React Email's Body is "ltr" and "en" unless told: the email's own, here. */}
        <Body lang={locale} dir={dir} className="bg-background text-foreground font-sans m-0 py-6">
          {/* lang and dir here too, not only on <html>: Gmail drops <html>, <head> and <body> and
              keeps what's inside, so an Arabic email would read left to right. */}
          <Container
            lang={locale}
            dir={dir}
            className="bg-card text-card-foreground rounded-lg border border-solid border-border"
          >
            <Section className="px-8 pt-8">
              {/* A table's cells follow the direction: the logo comes first in Arabic too. */}
              <Row className="mb-4">
                <Column className="w-8">
                  <Img src="cid:logo" width="24" height="24" alt="" />
                </Column>
                <Column>
                  <Text className="text-base font-semibold m-0">void-fbtee</Text>
                </Column>
              </Row>
              <Text className="font-heading text-2xl font-semibold m-0 mb-4">
                {titled(subject, title)}
              </Text>
              {lines.map((line, i) => (
                <Text key={i} className="text-base leading-6 m-0 mb-4">
                  {titled(line, title)}
                </Text>
              ))}
            </Section>
            <Section className="px-8 pb-8">
              {label ? (
                <Button
                  href={link}
                  className="bg-primary text-primary-foreground rounded-md px-5 py-3 text-base font-semibold"
                >
                  {label}
                </Button>
              ) : (
                <Section className="bg-muted rounded-md px-4 py-3">
                  <Text className="text-sm leading-6 m-0 break-all">
                    {/* An address reads left to right, in an Arabic email too. */}
                    <a href={link} dir="ltr" className="text-brand">
                      {link}
                    </a>
                  </Text>
                </Section>
              )}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** The email's HTML, in the site's look. */
export const emailHtml = (look: EmailLook) => render(<EmailLayout {...look} />);
