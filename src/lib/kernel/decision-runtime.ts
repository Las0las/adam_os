// L1 kernel — the Decision Runtime.
//
// LAWRENCE Runtime Kernel Spec v1.2 introduces an explicit runtime BETWEEN
// Authority and the Scheduler:
//
//   Intent → Authority → Decision → (Scheduler) → execution
//
//   Authority answers:  "MAY this happen?"      (a permission)
//   Decision answers:   "Exactly WHAT happens?" (a concrete, ordered plan)
//
// e.g. an authorized `object.create` for a Candidate decomposes into:
//   CreateCandidate · AssignRecruiter · RunDuplicateCheck · GenerateAISummary ·
//   ScheduleBackgroundWorkflow
//
// The Decision is pure data: given the same intent + authority it always
// produces the same plan (deterministic, content-hashed). The Scheduler later
// executes the steps; the Decision Runtime never executes anything itself.

import type { ExecutionAuthority, Intent } from "./contracts";
import { stableHash } from "./stable-hash";

/** How a step is carried out relative to the originating request. */
export type StepExecution = "immediate" | "scheduled" | "async";

/** A single concrete unit of work in a decision plan. */
export interface DecisionStep {
  /** Stable step id within the plan (e.g. "create", "assign-recruiter"). */
  id: string;
  /** Imperative label of what this step does. */
  label: string;
  /** The capability this step will spend when executed. */
  capability: string;
  /** When the step runs relative to the request. */
  execution: StepExecution;
  /** Step ids that must complete before this one. */
  dependsOn: string[];
  /** True when this step performs a write. */
  mutates: boolean;
}

/**
 * The concrete, ordered plan derived from an authorized intent. This is the
 * "exactly what will happen" that the scheduler executes. It is bound to the
 * authority that permitted it and is deterministic (decisionPlanId is a content
 * hash of the steps), so the same intent+authority always yields the same plan.
 */
export interface Decision {
  /** Content-derived id of this plan. */
  decisionPlanId: string;
  /** The kind of intent this plan fulfills. */
  intentKind: Intent["kind"];
  /** The authority that permits the plan. */
  authorityId: string;
  /** The constitutional decision behind the authority (traceability). */
  decisionId: string;
  enterpriseId: string;
  /** The ordered steps. */
  steps: DecisionStep[];
  /** Convenience: the single step that performs the primary mutation, if any. */
  primaryStepId: string | null;
}

/** Per-intent step planners. Each returns the ordered steps for an intent. */
function planSteps(intent: Intent, authority: ExecutionAuthority): DecisionStep[] {
  const objType = intent.object?.objectType ?? intent.projection?.objectType ?? "object";
  const cap = authority.capabilities[0] ?? `${intent.kind}:${objType}`;

  switch (intent.kind) {
    case "object.create": {
      const isCandidate = objType.toLowerCase().includes("candidate");
      const steps: DecisionStep[] = [
        { id: "create", label: `Create ${objType}`, capability: cap, execution: "immediate", dependsOn: [], mutates: true },
      ];
      if (isCandidate) {
        steps.push(
          { id: "assign-recruiter", label: "Assign owning recruiter", capability: `object:update:${objType}`, execution: "immediate", dependsOn: ["create"], mutates: true },
          { id: "duplicate-check", label: "Run duplicate check", capability: `read:${objType}`, execution: "async", dependsOn: ["create"], mutates: false },
          { id: "ai-summary", label: "Generate AI summary", capability: `intelligence:summarize:${objType}`, execution: "async", dependsOn: ["create"], mutates: false },
          { id: "background-workflow", label: "Schedule onboarding workflow", capability: `workflow:transition:${objType}`, execution: "scheduled", dependsOn: ["create"], mutates: false },
        );
      }
      return steps;
    }
    case "object.update":
      return [{ id: "update", label: `Update ${objType}`, capability: cap, execution: "immediate", dependsOn: [], mutates: true }];
    case "object.delete":
      return [{ id: "delete", label: `Delete ${objType}`, capability: cap, execution: "immediate", dependsOn: [], mutates: true }];
    case "projection.resolve":
      return [{ id: "resolve", label: `Resolve projection`, capability: cap, execution: "immediate", dependsOn: [], mutates: false }];
    case "workflow.transition":
      return [{ id: "transition", label: `Transition workflow`, capability: cap, execution: "immediate", dependsOn: [], mutates: true }];
    default:
      return [{ id: "act", label: intent.kind, capability: cap, execution: "immediate", dependsOn: [], mutates: false }];
  }
}

/**
 * PURE: compose the concrete decision plan from an authorized intent. Throws if
 * the authority is not granted — you cannot plan what you may not do.
 */
export function composeDecision(intent: Intent, authority: ExecutionAuthority): Decision {
  if (!authority.granted) {
    throw new Error(`Cannot compose a decision: authority ${authority.authorityId} is not granted.`);
  }
  const steps = planSteps(intent, authority);
  const decisionPlanId = `dp_${stableHash({
    a: authority.authorityId,
    k: intent.kind,
    s: steps.map((s) => [s.id, s.capability, s.execution, s.dependsOn]),
  })}`;
  const primary = steps.find((s) => s.mutates) ?? null;
  return {
    decisionPlanId,
    intentKind: intent.kind,
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    enterpriseId: intent.enterpriseId,
    steps,
    primaryStepId: primary?.id ?? null,
  };
}
