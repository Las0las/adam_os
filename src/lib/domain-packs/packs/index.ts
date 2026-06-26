// Phase 8 — domain pack registration barrel. Importing this module ensures the
// Phase 4 seed packs (for seedPackKey installs) and all seven Phase 8 manifests
// are registered.

import "@/lib/domains/phase4-packs"; // registers the 5 Phase 4 DomainSeedPacks + handlers

import "./recruiting-pack";
import "./onboarding-pack";
import "./support-pack";
import "./claims-pack";
import "./executive-commercial-pack";
import "./healthcare-ops-pack";
import "./professional-services-pack";
