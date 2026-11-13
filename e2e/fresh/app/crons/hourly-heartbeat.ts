// Void's docs example of a scheduled job (guide/jobs.md, crons/hourly-heartbeat.ts), with translated
// text. Void runs a job with no request, so there's no page language: the job picks its own with
// inLocale(). The fresh check runs it through Void's dev trigger (POST /__void/scheduled), which
// reports a job that throws, so the job checks its own text.
import { defineScheduled } from "void";
import { fbs } from "fbtee";
import { inLocale } from "void-fbtee/server";

export const cron = "0 * * * *";

export default defineScheduled(async () => {
  const heading = await inLocale("th-TH", () =>
    String(fbs("i18n for Void apps", "Home page heading")),
  );
  if (heading !== "i18n สำหรับแอป Void") throw new Error(`inLocale("th-TH") gave "${heading}"`);
});
