// `vp run og-image`: renders og-image.svg (the link preview picture) to public/og-1.png, 1200×630,
// with sharp. The PNG is committed. The number is its version: sharing apps keep a picture for a
// long time, so a new one gets a new name (og-2.png) and void.config.ts's og:image follows it.
import sharp from "sharp";
import { join } from "node:path";

const app = join(import.meta.dirname, "..");
const out = join(app, "public/og-1.png");
const info = await sharp(join(app, "og-image.svg")).png().toFile(out);
console.log(`${out}: ${info.width}×${info.height}`);
