// The live stream's route (src/live.ts): GET opens it, POST subscribes and unsubscribes. Under
// /api, so void-fbtee's middleware leaves it alone.
import { defineHandler } from "void";
import { live } from "../../src/live";

export const GET = defineHandler((c) => live.connect(c));
export const POST = defineHandler((c) => live.control(c));
