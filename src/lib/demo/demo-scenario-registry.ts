// Phase 8 — demo scenario lookup over the pack manifest registry.

import "@/lib/domain-packs/packs"; // ensure manifests are registered
import { listDomainPackManifests, getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import type { DemoScenario } from "@/lib/domain-packs/domain-pack-types";

export function listDemoScenarios(): DemoScenario[] {
  return listDomainPackManifests().flatMap((m) => m.demoScenarios);
}

export function listDemoScenariosForPack(packKey: string): DemoScenario[] {
  return getDomainPackManifest(packKey)?.demoScenarios ?? [];
}

export function getDemoScenario(packKey: string, demoKey: string): DemoScenario | undefined {
  return listDemoScenariosForPack(packKey).find((d) => d.key === demoKey);
}
