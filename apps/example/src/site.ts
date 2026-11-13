// The deployed site's address, in one place: voidFbtee({ site }) in vite.config.ts, and the link
// preview picture's full address in void.config.ts. Void's deploy summary shows it.
export const SITE = "https://void-fbtee-example.gedw99.workers.dev";

// Who the site's email comes from (a booking's confirmation). A placeholder for now: sending from
// the live site needs email set up on a domain the Cloudflare account has (Void's
// guide/email/domains.md, "Your own Cloudflare account"), which hasn't been decided. Until then
// Void's dev inbox takes every email, and the live site sends none (sendEmail answers
// BINDING_MISSING). Not email.from in void.config.ts: with it, Void's deploy would set up email.
export const EMAIL_FROM = "void-fbtee <events@events.ubuntusoftware.net>";
