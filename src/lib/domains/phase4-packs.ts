// Phase 4 — registration barrel. Importing this module loads all five domain
// seed packs (each self-registers its functions, actions, and DomainSeedPack via
// registerDomainSeedPack), so installAllDomainPacks() can install them.

import "./recruiting/recruiting-seed-pack";
import "./onboarding/onboarding-seed-pack";
import "./support/support-seed-pack";
import "./claims/claims-seed-pack";
import "./executive/executive-seed-pack";

export { recruitingSeedPack } from "./recruiting/recruiting-seed-pack";
export { onboardingSeedPack } from "./onboarding/onboarding-seed-pack";
export { supportSeedPack } from "./support/support-seed-pack";
export { claimsSeedPack } from "./claims/claims-seed-pack";
export { executiveSeedPack } from "./executive/executive-seed-pack";
