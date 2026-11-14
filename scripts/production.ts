// `vp run test:production`: the preview suite (e2e/preview/) against the live site the last
// `vp run deploy` deployed (scripts/production-url.ts). The tests that post or book skip
// themselves there (onLiveSite() in e2e/helpers.ts): on the live site they would call Workers AI
// and send real email.
import { testLastDeploy } from "./production-url";

testLastDeploy("test:production", "preview");
