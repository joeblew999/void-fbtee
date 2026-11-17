// Once a day: what people post kept in the app's languages, both ways (void-fbtee/crons/translations):
// translations into a language the app no longer has are deleted, and anything missing is asked for.
// A backstop: an event read in a language it lacks is asked for then. Void reads the schedule here.
export const cron = "17 4 * * *";
export { default } from "void-fbtee/crons/translations";
