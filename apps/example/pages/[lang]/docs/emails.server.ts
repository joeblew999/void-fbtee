import { defineHandler, defineHead, type InferProps } from "void";
import { fbs } from "fbtee";
import { pageHead } from "void-fbtee/head";
import { langParams } from "void-fbtee/server";
import { routeUrl } from "void-fbtee/routes";
import { bookingEmail, linkEmail, type Email } from "@/events/emails";
import logoUrl from "../../../public/pwa-192x192.png?url";

// Cached until the next deploy, in every language (Void's prerendering, as the Intl page): the
// emails are made from a fixed sample, so only a deploy changes them.
export const prerender = true;
export const getPrerenderPaths = langParams;

export type Props = InferProps<typeof loader>;

// The sample: the calligraphy evening as its organiser wrote it, in Arabic (the email tests'
// event), so on the English and Thai pages its title is in another language than the email.
const EVENT = {
  title: "أمسية خط عربي",
  titleLocale: "ar-EG",
  startsAt: "2027-03-08T19:00:00+02:00[Africa/Cairo]",
} as const;
const ID = "d57a8bf2-5909-4475-a407-12a879df5f01";

/** An email as the page shows it: the logo from the site's own file, as only a mail app reads cid:. */
const shown = (email: Email) => ({
  subject: email.subject,
  text: email.text,
  html: email.html.replaceAll("cid:logo", logoUrl),
});

// The app's own emails (src/events/emails.ts), made the way a booking and a posting make them, in
// this page's language: what a reader of this language gets.
export const loader = defineHandler(async (c) => {
  const { locale } = c.get("i18n");
  const origin = new URL(c.req.url).origin;
  const page = origin + routeUrl("/[lang]/events/[id]", { params: { id: ID } });
  const [booking, link] = await Promise.all([
    bookingEmail({ ...EVENT, locale, name: "Laila", url: page }),
    linkEmail({ ...EVENT, locale, link: `${page}#key=…` }),
  ]);
  return { booking: shown(booking), link: shown(link) };
});

// The intro's own string as the description, so it's translated once.
export const head = defineHead(() =>
  pageHead({
    title: fbs("Emails", "Docs page title: the page about the app's translated emails"),
    description: fbs(
      "This app emails people in their own language: a booking's confirmation, a reminder the day before, a cancellation, and the private link to delete an event. Here are two of them, made by the app's own code for a sample event, in this page's language, and what it takes for each to arrive the right way round.",
      "Emails page introduction",
    ),
  }),
);
