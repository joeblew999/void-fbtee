// Island used by the markdown blog posts: the post's date (a PlainDate from frontmatter) and
// reading time, formatted for the page's locale, plus a like button so it has a reason to hydrate.
import { useState } from "react";
import { fbt } from "fbtee";
import { Temporal } from "temporal-polyfill";
import { useFrontmatter } from "@void/md";
import { useIntl } from "void-fbtee/react";

export default function PostMeta() {
  const fm = useFrontmatter() as { date: string; minutes: number };
  const intl = useIntl();
  const [likes, setLikes] = useState(0);
  return (
    <p data-testid="post-meta">
      <span data-testid="post-date">
        {intl.date(Temporal.PlainDate.from(fm.date), { dateStyle: "long" })}
      </span>
      {" · "}
      <span data-testid="post-minutes">
        {intl.duration(Temporal.Duration.from({ minutes: fm.minutes }), { style: "long" })}
      </span>
      {" · "}
      <button data-testid="post-like" type="button" onClick={() => setLikes((n) => n + 1)}>
        <fbt desc="Like button on a blog post, with the number of likes">
          Like (<fbt:param name="count">{intl.number(likes)}</fbt:param>)
        </fbt>
      </button>
    </p>
  );
}
