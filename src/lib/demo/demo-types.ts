// Phase 8 — demo framework types. Re-exports the demo shapes (declared with the
// pack manifest) plus the run-record types, so demo modules import from one place.

export type {
  DemoScenario,
  DemoStep,
  DemoStepAction,
  DemoPersona,
  DemoRunStepResult,
  DomainPackDemoRun,
  DemoRunStatus,
} from "@/lib/domain-packs/domain-pack-types";
