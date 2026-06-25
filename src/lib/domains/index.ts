// Domain packs barrel (§48–§53). Importing this module triggers each pack's
// side-effect registration (functions / actions / object mappers) and exposes
// each pack's seed routine + agent factory for the bootstrap.

import "./recruiting/recruiting-pack";
import "./onboarding/onboarding-pack";
import "./support/support-pack";
import "./claims/claims-pack";
import "./commercial/commercial-pack";

export { shortlistBuilderAgent } from "./recruiting/recruiting-pack";
export { onboardingAgent, seedOnboarding } from "./onboarding/onboarding-pack";
export { supportTriageAgent, seedSupport } from "./support/support-pack";
export { claimsValidationAgent, seedClaims } from "./claims/claims-pack";
export { accountRiskMonitorAgent, seedCommercial } from "./commercial/commercial-pack";
