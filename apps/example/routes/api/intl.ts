// SPIKE: Intl output as seen inside workerd.
import { defineHandler } from "void";
import { battery } from "../../spike/intl-battery.mjs";
export const GET = defineHandler(() => battery());
