// `vp run test:deployed`: the quick live check (e2e/deployed/live.test.ts) against the site the last
// `vp run deploy` deployed (scripts/production-url.ts). CI's deploy job runs the two one after the
// other, as you would on your own machine. The full browser tests run on the preview.
import { testLastDeploy } from "./production-url";

testLastDeploy("test:deployed", "deployed");
