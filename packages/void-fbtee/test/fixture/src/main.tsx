// Test fixture: two strings, one translated into German in i18n/translations/de-DE.json.
import { fbt } from "fbtee";

export const hello = () => <fbt desc="Greeting in the test fixture">Hello</fbt>;
export const bye = () => <fbt desc="Farewell in the test fixture">Goodbye</fbt>;
