import { fbt } from "fbtee";

export default function About() {
  return (
    <main>
      <button type="button" data-testid="signup-take">
        <fbt desc="Button that takes one seat">Take a seat</fbt>
      </button>
    </main>
  );
}
