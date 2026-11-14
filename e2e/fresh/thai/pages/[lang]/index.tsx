// The fresh-install check's app written in Thai (`void-fbtee init --source-locale th-TH`): its code's
// text is Thai, and English and Arabic are the translations. A count too, since Thai writes one form
// for every number where Arabic has six.
import { fbt } from "fbtee";

export default function Home() {
  return (
    <main>
      <h1 data-testid="title">
        <fbt desc="Home page heading">งานของชุมชน</fbt>
      </h1>
      <p data-testid="seats">
        <fbt desc="How many seats are left for the event">
          เหลือ{" "}
          <fbt:plural count={3} many="ที่นั่ง" showCount="yes">
            ที่นั่ง
          </fbt:plural>
        </fbt>
      </p>
    </main>
  );
}
