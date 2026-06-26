// Phase 9 — default domain pack bundles for tenant bootstrap. Bundles compose
// the Phase 8 packs into vertical "operating systems".

export interface PackBundle {
  key: string;
  name: string;
  packKeys: string[];
}

export const PACK_BUNDLES: PackBundle[] = [
  { key: "staffing_recruiting_os", name: "Staffing / Recruiting OS", packKeys: ["recruiting", "onboarding", "executive"] },
  { key: "support_os", name: "Support OS", packKeys: ["support", "executive"] },
  { key: "claims_validation_os", name: "Claims Validation OS", packKeys: ["claims", "executive"] },
  { key: "professional_services_os", name: "Professional Services OS", packKeys: ["professional_services", "onboarding", "executive"] },
];

export function getBundle(key: string): PackBundle | undefined {
  return PACK_BUNDLES.find((b) => b.key === key);
}
