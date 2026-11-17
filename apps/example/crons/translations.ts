// Every hour: what people post kept in the app's languages, both ways (void-fbtee/crons/translations):
// translations into a language the app no longer has are deleted, and anything missing is queued.
// Void reads the schedule from here.
export const cron = "17 * * * *";
export { default } from "void-fbtee/crons/translations";
