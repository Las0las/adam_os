// Phase 8 — domain pack productization contracts. A DomainPackManifest declares
// everything a vertical needs to be installable, versioned, and demo-able on the
// production runtime. Existing Phase 4 DomainSeedPacks are reused via
// `seedPackKey`; new packs carry their own sampleObjects. Demo objects are
// marked `properties.__demo = true` so they can be filtered + safely reset.

import type { DomainObjectSeed } from "@/lib/domains/domain-seed-types";

export type DomainPackCategory =
  | "recruiting"
  | "onboarding"
  | "support"
  | "claims"
  | "executive"
  | "commercial"
  | "healthcare"
  | "professional_services"
  | "generic";

export type DemoPersona =
  | "executive"
  | "recruiter"
  | "operator"
  | "validator"
  | "support_agent";

export type DemoStepAction =
  | "install_pack"
  | "create_demo_objects"
  | "run_pipeline"
  | "run_function"
  | "run_agent"
  | "execute_action"
  | "open_command_center"
  | "open_object_detail"
  | "open_mission_control"
  | "show_evidence"
  | "show_audit"
  | "run_evals";

export interface DemoStep {
  key: string;
  title: string;
  description: string;
  action: DemoStepAction;
  payload: Record<string, unknown>;
  expectedOutcome: string;
}

export interface DemoScenario {
  key: string;
  packKey: string;
  name: string;
  description: string;
  persona: DemoPersona;
  estimatedMinutes: number;
  steps: DemoStep[];
}

export interface PackEvalSuiteSeed {
  key: string;
  name: string;
  suiteType: "retrieval" | "extraction" | "classification" | "response" | "recommendation" | "action";
  targetComponentKey: string;
  baselineScore: number;
  cases?: Array<{ input: Record<string, unknown>; expected: Record<string, unknown> }>;
}

export interface PackNotificationRuleSeed {
  name: string;
  eventKey: string;
  channel: "in_app" | "email" | "slack" | "teams";
  template: string;
}

export interface DomainPackManifest {
  key: string;
  name: string;
  version: string;
  category: DomainPackCategory;
  description: string;
  objectTypes: string[];
  linkTypes: string[];
  /** Reuse an existing Phase 4 DomainSeedPack (objects + fn/agent/action rows). */
  seedPackKey?: string;
  /** Referenced runtime keys (for catalog display). */
  functions: string[];
  agents: string[];
  actions: string[];
  notificationRules: PackNotificationRuleSeed[];
  evalSuites: PackEvalSuiteSeed[];
  demoScenarios: DemoScenario[];
  /** Demo sample objects (installer marks them demo). Packs reusing a seed pack
   *  may leave this empty and rely on the seed pack's sampleObjects. */
  sampleObjects: DomainObjectSeed[];
  /** Customer-readiness assets (Part G). */
  businessValue: string;
  implementationRoadmap: string[];
  requiredIntegrations: string[];
  dataRequired: string[];
  governanceControls: string[];
  successMetrics: string[];
}

// ── Persisted rows (tenant-scoped collections) ──────────────────────────────

export type InstallationStatus = "installed" | "disabled" | "failed" | "uninstalled";

export interface DomainPackInstallation {
  id: string;
  tenantId: string;
  packKey: string;
  packVersion: string;
  status: InstallationStatus;
  installedBy?: string | null;
  installedAt: string;
  disabledAt?: string | null;
  uninstalledAt?: string | null;
  metadata: Record<string, unknown>;
}

export type DemoRunStatus = "queued" | "running" | "completed" | "failed";

export interface DemoRunStepResult {
  stepKey: string;
  action: DemoStepAction;
  status: "completed" | "failed" | "skipped";
  outcome: string;
  produced: Record<string, unknown>;
  navigateTo?: string | null;
  error?: string | null;
}

export interface DomainPackDemoRun {
  id: string;
  tenantId: string;
  packKey: string;
  demoKey: string;
  status: DemoRunStatus;
  createdBy?: string | null;
  trace: { steps: DemoRunStepResult[] };
  createdAt: string;
  completedAt?: string | null;
}

export interface DomainPackCatalogEntry {
  manifest: DomainPackManifest;
  installed: boolean;
  installedVersion?: string | null;
  objectCount: number;
  workflowCount: number;
  demoCount: number;
}
