// The private delete link for whoever posts an event, as sites with no accounts do it: posting makes
// a random key, the database keeps only its SHA-256, and the poster's link carries the key after
// `#`, which never reaches the server or Void's page cache (plans/tidy-ember-ledger.md). Deleting
// (the event page's delete action) checks a key against it. Web Crypto, the Worker's own and Node's.
//
// Getting the key to the poster: a redirect's `#` part is lost on the way (Void's client reads it
// from fetch's response.url, which the Fetch standard always gives without it:
// https://github.com/voidzero-dev/void/issues/810; back to a redirect with `hash` once it's
// fixed), so posting sets a
// short-lived cookie with the key instead (keyCookie), and the event page moves it into its own
// `#` and deletes the cookie. A request with a cookie skips Void's page cache
// (guide/edge/revalidation.md, "Cache bypass"): only the poster's, for those two minutes.
//
// Keeping it (plans/sure-keeper-link.md): the event page keeps a copy in the browser's storage and
// puts it back in the address when an action there has written the address without it; and the
// poster can have the link emailed when posting (src/events/emails.ts).

/** The cookie that carries a new event's key to its page: its name, and the header that sets it. */
export const keyCookieName = (id: string) => `event-key-${id}`;
export const keyCookie = (id: string, key: string) =>
  `${keyCookieName(id)}=${key}; Path=/; Max-Age=120; SameSite=Lax; Secure`;

/** 32 random bytes as base64url: the key. */
export function newDeleteKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The key's SHA-256, in hex: what the database keeps. */
export async function hashDeleteKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether `key` is the one `hash` was made from, compared in the same time whatever differs. */
export async function deleteKeyMatches(key: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  const given = await hashDeleteKey(key);
  let differs = given.length ^ hash.length;
  for (let i = 0; i < given.length; i++)
    differs |= given.charCodeAt(i) ^ hash.charCodeAt(i % hash.length);
  return differs === 0;
}
