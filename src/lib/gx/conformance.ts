// L1 — RFC-C0-X · conformance harness.
//
// Proves the six constitutional laws of Governed Execution against the REAL
// runtime — it runs actual executions and asserts the laws hold on the produced
// records. Pure and deterministic given an injected `now`.

import type { Intent } from "@/lib/kernel";
import type { ExecutionObjective, GovernedExecution, LawConformance } from "./contracts";
import { runGovernedExecution } from "./runtime";
import { getExecutions, replayExecutions } from "./execution-record";

/** A resolved human actor that the constitution will authorize for a write. */
function grantedIntent(): Intent {
  return {
    kind: "object.create",
    actor: {
      kind: "human",
      id: "u_reinia",
      label: "Reinia Hall",
      tenantId: "lawrence",
      permissions: ["object:create:Candidate"],
    },
    enterpriseId: "lawrence",
    object: { objectType: "Candidate", isMutation: false },
    audited: true,
  };
}

/** An anonymous mutation the constitution MUST deny (INV-IDENTITY, fail-closed). */
function deniedIntent(): Intent {
  return {
    kind: "object.create",
    actor: { kind: "anonymous", id: null, tenantId: null, permissions: [] },
    enterpriseId: "lawrence",
    object: { objectType: "Job", isMutation: false },
    audited: true,
  };
}

function objective(id: string, statement: string, expectedOutcome: string): ExecutionObjective {
  return { id, statement, expectedOutcome };
}

function countDims(o: GovernedExecution["observation"]): number {
  let n = 0;
  if (o.what) n++;
  if (o.why) n++;
  if (o.who && o.who.kind) n++;
  if (o.which.length > 0) n++;
  if (o.when.startedAt) n++;
  if (o.decisions.length > 0) n++;
  return n;
}

/**
 * Run the conformance suite. Returns one finding per constitutional law plus the
 * sample records it produced, so a surface can both prove the laws and show the
 * executions that proved them.
 */
export function verifyExecutionLifecycle(now: number = Date.UTC(2026, 6, 1)): {
  findings: LawConformance[];
  granted: GovernedExecution;
  denied: GovernedExecution;
  failing: GovernedExecution;
} {
  const granted = runGovernedExecution({
    intent: grantedIntent(),
    objective: objective("OBJ-HIRE", "Onboard a new candidate into the pipeline", "Candidate created, recruiter assigned, onboarding scheduled"),
    now,
  });
  const denied = runGovernedExecution({
    intent: deniedIntent(),
    objective: objective("OBJ-JOB", "Open a new job requisition", "Job created and routed for approval"),
    now: now + 1000,
  });
  const failing = runGovernedExecution({
    intent: grantedIntent(),
    objective: objective("OBJ-HIRE-2", "Onboard a second candidate", "Candidate created and fully enriched"),
    now: now + 2000,
    injectFailingStep: "ai-summary",
  });

  const findings: LawConformance[] = [];

  // C0-X.1 — Planned Execution: a plan with objective + strategy + expected
  // outcome exists, and Plan completes before Execute.
  {
    const p = granted.plan;
    const planIdx = granted.phasesCompleted.indexOf("plan");
    const execIdx = granted.phasesCompleted.indexOf("execute");
    const ok =
      Boolean(p && p.objective.statement && p.strategy.steps.length > 0 && p.expectedOutcome) &&
      planIdx >= 0 && execIdx > planIdx;
    findings.push({
      law: "C0-X.1",
      title: "Planned Execution",
      satisfied: ok,
      detail: ok
        ? `Plan ${p.planId} (${p.strategy.steps.length} steps) precedes execution.`
        : "An execution ran without a complete, prior plan.",
    });
  }

  // C0-X.2 — Governed Execution: a denied authority halts; no step runs.
  {
    const ok = denied.granted === false && denied.stepOutcomes.length === 0 && denied.status === "denied";
    findings.push({
      law: "C0-X.2",
      title: "Governed Execution",
      satisfied: ok,
      detail: ok
        ? "Denied authority halted execution before any step ran — governance was not bypassed."
        : "A denied execution still ran steps (governance bypass).",
    });
  }

  // C0-X.3 — Observable Execution: all six observation dimensions present and the
  // evidence references the canonical journal (not a private log).
  {
    const dims = countDims(granted.observation);
    const ok = dims === 6 && granted.observation.journalRefs.length > 0;
    findings.push({
      law: "C0-X.3",
      title: "Observable Execution",
      satisfied: ok,
      detail: ok
        ? `All 6 observation dimensions present; ${granted.observation.journalRefs.length} canonical journal entries referenced.`
        : `Only ${dims}/6 observation dimensions present.`,
    });
  }

  // C0-X.4 — Evaluated Execution: a 7-dimension evaluation exists AND is in the
  // permanent record store.
  {
    const e = granted.evaluation;
    const hasAllDims =
      Boolean(e.outcome) &&
      typeof e.quality === "number" &&
      typeof e.confidence === "number" &&
      typeof e.evidenceCoverage === "number" &&
      Boolean(e.policyCompliance) &&
      Boolean(e.resourceConsumption) &&
      Boolean(e.risk);
    const inRecord = getExecutions().some((r) => r.executionId === granted.executionId);
    const ok = hasAllDims && inRecord;
    findings.push({
      law: "C0-X.4",
      title: "Evaluated Execution",
      satisfied: ok,
      detail: ok
        ? `Evaluation (${e.outcome}, quality ${e.quality.toFixed(2)}) is part of the permanent record.`
        : "Evaluation missing dimensions or not recorded permanently.",
    });
  }

  // C0-X.5 — Immutable History: the record is frozen, deterministic on replay,
  // and a correction creates a NEW record rather than mutating the original.
  {
    const frozen = Object.isFrozen(granted);
    // Re-run the identical input → idempotent, identical hash (deterministic replay).
    const rerun = runGovernedExecution({
      intent: grantedIntent(),
      objective: objective("OBJ-HIRE", "Onboard a new candidate into the pipeline", "Candidate created, recruiter assigned, onboarding scheduled"),
      now,
    });
    const deterministic = rerun.recordHash === granted.recordHash && rerun.executionId === granted.executionId;
    // A correction is a NEW record; the original is untouched.
    const correction = runGovernedExecution({
      intent: grantedIntent(),
      objective: objective("OBJ-HIRE", "Onboard a new candidate into the pipeline", "Candidate created, recruiter assigned, onboarding scheduled"),
      now: now + 5000,
      corrects: granted.executionId,
    });
    const correctionIsNew =
      correction.executionId !== granted.executionId &&
      correction.corrects === granted.executionId &&
      granted.recordHash === rerun.recordHash; // original unchanged
    const replayCount = replayExecutions(0, (n) => n + 1);
    const ok = frozen && deterministic && correctionIsNew && replayCount === getExecutions().length;
    findings.push({
      law: "C0-X.5",
      title: "Immutable History",
      satisfied: ok,
      detail: ok
        ? "Records are frozen + deterministic on replay; corrections append new records, never mutate history."
        : "History was mutable, non-deterministic, or corrections rewrote the original.",
    });
  }

  // C0-X.6 — Continuous Improvement: optimization creates a NEW strategy derived
  // from the original without mutating it; learning influences the future only.
  {
    const opt = failing.optimizedStrategy;
    const original = failing.plan.strategy;
    // The failing run injected one bad step, so the optimized strategy must add
    // exactly one guard step. The original strategy is frozen (cannot be mutated)
    // and keeps its own step count — optimization made something NEW.
    const ok =
      opt !== null &&
      opt.derivedFrom === original.id &&
      opt.id !== original.id &&
      opt.steps.length === original.steps.length + 1 &&
      Object.isFrozen(original) &&
      failing.learnings.length > 0 &&
      failing.learnings.every((l) => l.influencesFuture === true);
    findings.push({
      law: "C0-X.6",
      title: "Continuous Improvement",
      satisfied: ok,
      detail: ok
        ? `Optimized strategy ${opt!.id} (${opt!.steps.length} steps) derived from ${original.id} (${original.steps.length}); original frozen + unchanged.`
        : "Optimization rewrote history or produced no new strategy.",
    });
  }

  return { findings, granted, denied, failing };
}
