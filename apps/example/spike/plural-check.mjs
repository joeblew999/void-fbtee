// SPIKE: fbtee#83: does collect keep the count token for plurals with showCount="no"?
import { collectSync } from "@nkzw/fbtee-compiler";
const src = (show) => `import { fbt } from "fbtee";
export const X = (n) => <fbt desc="books"><fbt:plural count={n} many="books" showCount="${show}" name="bookCount">book</fbt:plural></fbt>;`;
for (const show of ["yes", "no"]) {
  const out = JSON.parse(
    collectSync("x.tsx", src(show), { lang: "tsx", collectPackager: "text" }).output,
  );
  console.log(`showCount="${show}": token map =`, JSON.stringify(out.phrases[0].jsfbt.m));
}
