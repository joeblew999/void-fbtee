// Browser only. The void-fbtee plugin imports this at the top of every client module that uses
// <fbt> or fbs. Its top-level await holds those modules until the page's catalog is installed,
// so <fbt> renders translated from its first render: in islands (hydrated on their own, without
// the layout's I18nProvider) and in regular pages alike.
import { install, documentI18n } from "./install";

const i18n = documentI18n();
if (i18n) await install(i18n.locale);
