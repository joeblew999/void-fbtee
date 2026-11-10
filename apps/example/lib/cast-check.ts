// SPIKE: a plain .ts file with an fbs string and an old-style `<T>value` cast, which only parses as TypeScript.
import { fbs } from "fbtee";

const raw: unknown = 3;
export const nights = <number>raw;
export const label = () => fbs("Nights booked", "Label next to a night count");
