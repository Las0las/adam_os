// Phase 8 — per-pack implementation roadmaps (in-app asset), sourced from the
// registered manifests.

import "@/lib/domain-packs/packs";
import { listDomainPackManifests, getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";

export interface PackRoadmap {
  packKey: string;
  name: string;
  implementationRoadmap: string[];
  requiredIntegrations: string[];
  dataRequired: string[];
}

export function getRoadmaps(): PackRoadmap[] {
  return listDomainPackManifests().map((m) => ({
    packKey: m.key,
    name: m.name,
    implementationRoadmap: m.implementationRoadmap,
    requiredIntegrations: m.requiredIntegrations,
    dataRequired: m.dataRequired,
  }));
}

export function getRoadmap(packKey: string): PackRoadmap | undefined {
  const m = getDomainPackManifest(packKey);
  if (!m) return undefined;
  return {
    packKey: m.key,
    name: m.name,
    implementationRoadmap: m.implementationRoadmap,
    requiredIntegrations: m.requiredIntegrations,
    dataRequired: m.dataRequired,
  };
}
