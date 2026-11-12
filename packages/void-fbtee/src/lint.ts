// void-fbtee's lint rule, for Vite+ (`lint.jsPlugins: ["void-fbtee/lint"]`, which `void-fbtee init`
// adds). Written with Vite+'s plugin authoring API, `vite-plus/lint/plugins`, as Vite+'s lint guide
// asks: the copy of Oxlint's API that ships with Vite+, so it always matches the linter that loads
// it. definePlugin and defineRule pass their input through; they give the rule Oxlint's types.
// Plain-Vite apps get the same check from `void-fbtee check`.
//
//   void-fbtee/no-show-count-no   plurals with showCount="no" drop their count token (fbtee#83)
import { definePlugin, defineRule } from "vite-plus/lint/plugins";

const isNo = (v: unknown) =>
  typeof v === "object" &&
  v !== null &&
  (v as { type?: unknown }).type === "Literal" &&
  (v as { value?: unknown }).value === "no";

const noShowCountNo = defineRule({
  meta: {
    type: "problem",
    docs: { description: 'Disallow showCount="no" on fbtee plurals (fbtee#83)' },
    messages: {
      showCountNo:
        'showCount="no" drops the count from the translation (fbtee#83). Use showCount="yes" or "ifMany".',
    },
    schema: [],
  },
  create(context) {
    return {
      // <fbt:plural showCount="no">
      JSXAttribute(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          node.name.name === "showCount" &&
          isNo(node.value)
        )
          context.report({ node, messageId: "showCountNo" });
      },
      // fbt.plural("…", n, { showCount: "no" })
      Property(node) {
        const key =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? node.key.value
              : undefined;
        if (key === "showCount" && isNo(node.value))
          context.report({ node, messageId: "showCountNo" });
      },
    };
  },
});

export default definePlugin({
  meta: { name: "void-fbtee" },
  rules: { "no-show-count-no": noShowCountNo },
});
