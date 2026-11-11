import { defineHandler } from "void";

// An API route: the void-fbtee middleware leaves it alone (no catalogs, no locale prefix).
export const GET = defineHandler(() => ({ message: "Hello from Void" }));
