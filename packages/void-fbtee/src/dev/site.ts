// The site's own address (voidFbtee({ site }), void-fbtee init --site): checked the same way in both.

/** voidFbtee({ site }) must be an https address of a host alone, as canonical URLs are built on it. */
export function checkSite(site: string): void {
  let url: URL | undefined;
  try {
    url = new URL(site);
  } catch {}
  if (!url || url.protocol !== "https:" || url.origin !== site)
    throw new Error(
      `voidFbtee({ site }): "${site}" isn't an https address of a host alone, e.g. "https://example.com" (no path, no trailing slash)`,
    );
}
