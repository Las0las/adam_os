// Phase 8 — demo script read surface for the demo catalog + pack demo lists.

import {
  listDemoScenarios,
  listDemoScenariosForPack,
  getDemoScenario,
} from "./demo-scenario-registry";
import type { DemoScenario } from "@/lib/domain-packs/domain-pack-types";

export function getAllDemos(): DemoScenario[] {
  return listDemoScenarios();
}

export function getPackDemos(packKey: string): DemoScenario[] {
  return listDemoScenariosForPack(packKey);
}

export function getDemo(packKey: string, demoKey: string): DemoScenario | undefined {
  return getDemoScenario(packKey, demoKey);
}
