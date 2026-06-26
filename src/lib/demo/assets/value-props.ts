// Phase 8 — per-pack value propositions (in-app implementation asset), sourced
// from the registered manifests so they never drift from the catalog.

import "@/lib/domain-packs/packs";
import { listDomainPackManifests, getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";

export interface PackValueProp {
  packKey: string;
  name: string;
  businessValue: string;
  successMetrics: string[];
}

export function getValueProps(): PackValueProp[] {
  return listDomainPackManifests().map((m) => ({
    packKey: m.key,
    name: m.name,
    businessValue: m.businessValue,
    successMetrics: m.successMetrics,
  }));
}

export function getValueProp(packKey: string): PackValueProp | undefined {
  const m = getDomainPackManifest(packKey);
  if (!m) return undefined;
  return { packKey: m.key, name: m.name, businessValue: m.businessValue, successMetrics: m.successMetrics };
}
