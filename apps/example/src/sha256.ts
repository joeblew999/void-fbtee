// SHA-256 in hex, with Web Crypto (the Worker's own and Node's): the delete key's stored hash
// (src/events/delete-key.ts) and the sample ticket's version (src/events/tickets.ts).
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
