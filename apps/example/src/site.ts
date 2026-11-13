// The deployed site's address, in one place: voidFbtee({ site }) in vite.config.ts, and the link
// preview picture's full address in void.config.ts. Void's deploy summary shows it.
export const SITE = "https://void-fbtee-example.gedw99.workers.dev";

// Who the site's email comes from (a booking's confirmation): email.from in void.config.ts, which
// `void email setup` set up on Cloudflare, and the sender sendBookingEmail passes (outside the
// Worker, as in tests, sendEmail has no default sender).
export const EMAIL_FROM = "void-fbtee <events@events.ubuntusoftware.net>";
