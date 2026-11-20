// The packed package (setup.ts), checked as Void checks its own (packed-registry.mjs,
// inspectPackage), plus: only what it should hold, and every export and the command in it.
import { execFileSync } from "node:child_process";
import { describe, expect, inject, test } from "vite-plus/test";
import {
  field,
  isRecord,
  parseJson,
  textField,
  textRecord,
} from "../../packages/void-fbtee/src/guards";
import { got } from "../got";
import "../provided";

const skip = inject("freshSkip") ?? "";
describe.skipIf(Boolean(skip))(`the tarball${skip ? ` (${skip})` : ""}`, () => {
  const tgz = got(inject("freshTarball"), "the packed tarball");
  const manifest = parseJson(
    execFileSync("tar", ["-xOf", tgz, "package/package.json"], { encoding: "utf8" }),
  );
  const files = execFileSync("tar", ["-tf", tgz], { encoding: "utf8" }).trim().split("\n");
  const https = (u: unknown) => typeof u === "string" && u.startsWith("https://");

  test("a description, the MIT license, https homepage and bugs", () => {
    expect(textField(manifest, "description")?.trim()).toBeTruthy();
    expect(field(manifest, "license")).toBe("MIT");
    expect(https(field(manifest, "homepage")) && https(field(field(manifest, "bugs"), "url"))).toBe(
      true,
    );
  });
  test("no other package copied into it", () => {
    // tsdown lists any package it copied into the build here (code or types).
    expect(field(manifest, "inlinedDependencies")).toBeUndefined();
  });
  test("no workspace or catalog versions", () => {
    const unpacked = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]
      .flatMap((f) => Object.entries(textRecord(field(manifest, f))))
      .filter(([, v]) => /^(workspace:|catalog:|link:|file:)/.test(v));
    expect(unpacked).toEqual([]);
  });
  test("only dist, skills, README.md, LICENSE and package.json", () => {
    expect(files).toContain("package/LICENSE");
    expect(files).toContain("package/README.md");
    const stray = files.filter(
      (f) => !/^package\/(dist\/|skills\/|README\.md$|LICENSE$|package\.json$)/.test(f),
    );
    expect(stray).toEqual([]);
  });
  test("every export and the command is in it", () => {
    const targetsOf = (v: unknown): Array<string> =>
      typeof v === "string" ? [v] : Object.values(isRecord(v) ? v : {}).flatMap(targetsOf);
    const missing = [
      ...targetsOf(field(manifest, "exports")),
      ...Object.values(textRecord(field(manifest, "bin"))),
    ]
      .map((p) => `package/${p.replace(/^\.\//, "")}`)
      .filter((p) => !files.includes(p));
    expect(missing).toEqual([]);
  });
});
