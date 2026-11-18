// A short fingerprint of what a translation was made from, to tell when it's out of date: a
// markdown page's (check.ts markdownHash, its `translatedFrom`) and a post's fields
// (content.ts, a translation's `translated_from`). The first 12 hex characters of SHA-256, from
// Node's crypto: in `vp dev`, and in the Worker, where Void always turns on Cloudflare's
// nodejs_compat (Void 1.8.0's dist/index.mjs adds it to every Worker's compatibility flags).
import { createHash } from "node:crypto";

export const fingerprint = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 12);
