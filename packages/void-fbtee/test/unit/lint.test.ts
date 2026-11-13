// The lint rule, with Vite+'s RuleTester (vite-plus/lint/plugins-dev, as Vite+'s lint guide says),
// on real Oxlint parsing: both forms of showCount="no", and the values it leaves alone.
import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../../src/lint";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("no-show-count-no", plugin.rules["no-show-count-no"]!, {
  valid: [
    `<fbt desc="d"><fbt:plural count={n} showCount="yes">night</fbt:plural></fbt>`,
    `<fbt desc="d"><fbt:plural count={n} showCount="ifMany">night</fbt:plural></fbt>`,
    `fbt.plural("night", n, { showCount: "yes" })`,
    `const options = { count: "no" }`,
  ],
  invalid: [
    {
      code: `<fbt desc="d"><fbt:plural count={n} showCount="no">night</fbt:plural></fbt>`,
      errors: [{ messageId: "showCountNo" }],
    },
    {
      code: `fbt.plural("night", n, { showCount: "no" })`,
      errors: [{ messageId: "showCountNo" }],
    },
    {
      code: `fbt.plural("night", n, { "showCount": "no" })`,
      errors: [{ messageId: "showCountNo" }],
    },
  ],
});
