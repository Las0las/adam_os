// Phase 8 — per-pack one-pager (in-app sales/implementation asset) composing the
// manifest's business value, roadmap, data, governance, and success metrics.

import "@/lib/domain-packs/packs";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { securityGovernanceSummary } from "./security-governance-summary";

export interface PackOnePager {
  packKey: string;
  name: string;
  category: string;
  version: string;
  description: string;
  businessValue: string;
  implementationRoadmap: string[];
  requiredIntegrations: string[];
  dataRequired: string[];
  governanceControls: string[];
  successMetrics: string[];
  platformGovernance: { heading: string; detail: string }[];
}

export function getOnePager(packKey: string): PackOnePager | undefined {
  const m = getDomainPackManifest(packKey);
  if (!m) return undefined;
  return {
    packKey: m.key,
    name: m.name,
    category: m.category,
    version: m.version,
    description: m.description,
    businessValue: m.businessValue,
    implementationRoadmap: m.implementationRoadmap,
    requiredIntegrations: m.requiredIntegrations,
    dataRequired: m.dataRequired,
    governanceControls: m.governanceControls,
    successMetrics: m.successMetrics,
    platformGovernance: securityGovernanceSummary.points,
  };
}
