// void-fbtee's lint rule, for Vite+ (`lint.jsPlugins: ["void-fbtee/lint"]`) or ESLint. A plain
// ESLint-format plugin with no imports, so it loads in both.
//
//   void-fbtee/no-show-count-no   plurals with showCount="no" drop their count token (fbtee#83)

interface Node {
  type: string;
  name?: { type: string; name?: string };
  key?: { type: string; name?: string; value?: unknown };
  value?: { type: string; value?: unknown } | null;
}
interface Context {
  report(descriptor: { node: unknown; message: string }): void;
}

const MESSAGE =
  'showCount="no" drops the count from the translation (fbtee#83). Use showCount="yes" or "ifMany".';

const isNo = (v: { type: string; value?: unknown } | null | undefined) =>
  v?.type === "Literal" && v.value === "no";

const noShowCountNo = {
  meta: {
    type: "problem",
    docs: { description: 'Disallow showCount="no" on fbtee plurals (fbtee#83)' },
    schema: [],
  },
  create(context: Context) {
    return {
      // <fbt:plural showCount="no">
      JSXAttribute(node: Node) {
        if (
          node.name?.type === "JSXIdentifier" &&
          node.name.name === "showCount" &&
          isNo(node.value)
        )
          context.report({ node, message: MESSAGE });
      },
      // fbt.plural("…", n, { showCount: "no" })
      Property(node: Node) {
        const key = node.key?.type === "Identifier" ? node.key.name : node.key?.value;
        if (key === "showCount" && isNo(node.value)) context.report({ node, message: MESSAGE });
      },
    };
  },
};

const plugin = {
  meta: { name: "void-fbtee" },
  rules: { "no-show-count-no": noShowCountNo },
};

export default plugin;
