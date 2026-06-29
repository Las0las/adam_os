// L1 — RFC-C0-X · the Governed Execution Lifecycle runtime.
//
// Composes the L0 kernel into the normative 8-phase lifecycle and enforces the
// six constitutional laws. It NEVER reinvents authority or journalling: the
// Govern phase spends the kernel's real ExecutionAuthority and the canonical
// append-only Journal is the observation source. The runtime is pure and
// deterministic given an injected `now` — the same intent + objective always
// produces the same GovernedExecution (same recordHash).

import {
  Kernel,
  appendJournal,
  getJournal,
  journalSize,
  stableHash,
  type Intent,
} from "@/lib/kernel";
import {
  type ExecutionObjective,
  type ExecutionPlan,
  type ExecutionStrategy,
  type GovernedExecution,
  type LearningSignal,
  type ObservedEvidence,
  type StepOutcome,
  type StrategyStep,
  type ExecutionEvaluation,
  type ExecutionPhase,
  type ExecutionStatus,
} from "./contracts";
import { appendExecution } from "./execution-record";

/** Input to a single run of the lifecycle. */
export interface RunInput {
  intent: Intent;
  objective: ExecutionObjective;
  /** Logical now (ms). Injected for determinism. */
  now: number;
  /** Test/demo hook: a step id that should fail during Execute (C0-X.4 proof). */
  injectFailingStep?: string;
  /** If this run corrects a prior execution, its id (C0-X.5 corrections). */
  corrects?: string;
}

// ── C0-X.1 Plan ─────────────────────────────────────────────────────────────

/**
 * Derive the proposed strategy from the intent — deterministically and WITHOUT
 * authority (planning precedes governing). Mirrors the kernel decision planner's
 * shape at the strategy level so the plan reflects what will really happen.
 */
function proposeStrategy(intent: Intent): ExecutionStrategy {
  const objType = intent.object?.objectType ?? intent.projection?.objectType ?? "object";
  const steps: StrategyStep[] = [];
  switch (intent.kind) {
    case "object.create": {
      steps.push({ id: "create", label: `Create ${objType}`, mode: "immediate", mutates: true });
      if (objType.toLowerCase().includes("candidate")) {
        steps.push(
          { id: "assign-recruiter", label: "Assign owning recruiter", mode: "immediate", mutates: true },
          { id: "duplicate-check", label: "Run duplicate check", mode: "async", mutates: false },
          { id: "ai-summary", label: "Generate AI summary", mode: "async", mutates: false },
          { id: "onboarding-workflow", label: "Schedule onboarding workflow", mode: "scheduled", mutates: false },
        );
      }
      break;
    }
    case "object.update":
      steps.push({ id: "update", label: `Update ${objType}`, mode: "immediate", mutates: true });
      break;
    case "object.delete":
      steps.push({ id: "delete", label: `Delete ${objType}`, mode: "immediate", mutates: true });
      break;
    case "workflow.transition":
      steps.push({ id: "transition", label: "Transition workflow", mode: "immediate", mutates: true });
      break;
    case "projection.resolve":
      steps.push({ id: "resolve", label: "Resolve projection", mode: "immediate", mutates: false });
      break;
    default:
      steps.push({ id: "act", label: intent.kind, mode: "immediate", mutates: false });
  }
  const id = `strat_${stableHash({ k: intent.kind, o: objType, s: steps.map((s) => s.id) })}`;
  return { id, label: `Strategy for ${intent.kind}`, steps, derivedFrom: null };
}

/** Build the explicit execution plan that MUST exist before execution (C0-X.1). */
export function planExecution(intent: Intent, objective: ExecutionObjective, now: number): ExecutionPlan {
  const strategy = proposeStrategy(intent);
  const createdAt = new Date(now).toISOString();
  const planId = `plan_${stableHash({ o: objective.id, s: strategy.id, e: objective.expectedOutcome })}`;
  return { planId, objective, strategy, expectedOutcome: objective.expectedOutcome, createdAt };
}

// ── C0-X.6 Optimize ──────────────────────────────────────────────────────--

/**
 * Create a NEW strategy informed by what happened — never mutate the plan's
 * strategy (C0-X.6: optimization creates new strategies, it does not rewrite
 * history). When a step failed, the optimized strategy inserts a guard before it.
 */
function optimizeStrategy(plan: ExecutionPlan, outcomes: StepOutcome[]): ExecutionStrategy | null {
  const failed = outcomes.find((o) => o.status === "failed");
  let steps: StrategyStep[];
  if (failed) {
    const guard: StrategyStep = {
      id: `precheck-${failed.stepId}`,
      label: `Precondition guard for "${failed.label}"`,
      mode: "immediate",
      mutates: false,
    };
    steps = [];
    for (const s of plan.strategy.steps) {
      if (s.id === failed.stepId) steps.push(guard);
      steps.push({ ...s });
    }
  } else {
    // Clean success → promote the same step shape as a named preferred strategy.
    steps = plan.strategy.steps.map((s) => ({ ...s }));
  }
  const id = `strat_${stableHash({ from: plan.strategy.id, s: steps.map((s) => s.id) })}`;
  if (id === plan.strategy.id) return null; // nothing new to propose
  return {
    id,
    label: failed ? `${plan.strategy.label} + guard` : `${plan.strategy.label} (preferred)`,
    steps,
    derivedFrom: plan.strategy.id,
  };
}

// ── Evaluation (C0-X.4) ─────────────────────────────────────────────────────

function countObservedDimensions(o: ObservedEvidence): number {
  let n = 0;
  if (o.what) n++;
  if (o.why) n++;
  if (o.who) n++;
  if (o.which.length > 0) n++;
  if (o.when.steps.length > 0 || o.when.startedAt) n++;
  if (o.decisions.length > 0) n++;
  return n;
}

function evaluate(
  granted: boolean,
  outcomes: StepOutcome[],
  observation: ObservedEvidence,
  durationMs: number,
  at: string,
): ExecutionEvaluation {
  const total = outcomes.length;
  const succeeded = outcomes.filter((o) => o.status === "succeeded").length;
  const mutations = outcomes.filter((o) => o.mutated && o.status === "succeeded").length;
  const evidenceCoverage = countObservedDimensions(observation) / 6;

  if (!granted) {
    return {
      outcome: "failure",
      quality: 0,
      confidence: 0.9, // high confidence it failed: the denial is evidenced
      evidenceCoverage,
      policyCompliance: "violations",
      resourceConsumption: { steps: 0, mutations: 0, durationMs },
      risk: "high",
      rationale: "Authority was denied; execution did not run. Governance was not bypassed.",
      at,
    };
  }
  const allOk = total > 0 && succeeded === total;
  const quality = total === 0 ? 1 : succeeded / total;
  return {
    outcome: allOk ? "success" : "partial",
    quality,
    confidence: 0.9,
    evidenceCoverage,
    policyCompliance: "compliant",
    resourceConsumption: { steps: total, mutations, durationMs },
    risk: allOk ? "low" : "medium",
    rationale: allOk
      ? `All ${total} step(s) succeeded under granted authority.`
      : `${succeeded}/${total} step(s) succeeded; ${total - succeeded} failed.`,
    at,
  };
}

// ── Learn (C0-X.6) ───────────────────────────────────────────────────────--

function deriveLearnings(
  granted: boolean,
  outcomes: StepOutcome[],
  evaluation: ExecutionEvaluation,
): LearningSignal[] {
  const out: LearningSignal[] = [];
  if (!granted) {
    out.push({
      id: `learn_${stableHash({ t: "denied", r: evaluation.rationale })}`,
      observation: "Authority was denied. Future plans should resolve the missing constitutional condition before submitting the intent.",
      influencesFuture: true,
    });
    return out;
  }
  const failed = outcomes.filter((o) => o.status === "failed");
  if (failed.length > 0) {
    out.push({
      id: `learn_${stableHash({ t: "failed", s: failed.map((f) => f.stepId) })}`,
      observation: `Step(s) ${failed.map((f) => f.label).join(", ")} failed. Future strategies should add a precondition guard before them.`,
      influencesFuture: true,
    });
  } else {
    out.push({
      id: `learn_${stableHash({ t: "ok", n: outcomes.length })}`,
      observation: `Strategy achieved the objective in ${outcomes.length} step(s) with quality ${evaluation.quality.toFixed(2)}; promote as a preferred strategy.`,
      influencesFuture: true,
    });
  }
  return out;
}

// ── The orchestrator ─────────────────────────────────────────────────────--

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[k]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Run one intent through the full governed-execution lifecycle and return the
 * immutable, appended record. Phases: Intent → Plan → Govern → Execute →
 * Observe → Evaluate → Learn → Optimize.
 */
export function runGovernedExecution(input: RunInput): GovernedExecution {
  const { intent, objective, now } = input;
  const phasesCompleted: ExecutionPhase[] = ["intent"];

  // C0-X.1 PLAN — must exist before anything executes.
  const plan = planExecution(intent, objective, now);
  phasesCompleted.push("plan");

  // Logical clock for deterministic timestamps/duration.
  let clock = now;
  const startedAt = new Date(clock).toISOString();
  const tick = (ms: number) => {
    clock += ms;
    return new Date(clock).toISOString();
  };

  // C0-X.3 — capture the journal boundary so observation references only THIS
  // execution's canonical journal entries (not an implementation-private log).
  const journalBefore = journalSize();

  // C0-X.2 GOVERN — spend real kernel authority. Not bypassable: a denial halts.
  const authority = Kernel.requestAuthority(intent, clock);
  phasesCompleted.push("govern");
  const granted = authority.granted;

  // C0-X EXECUTE — run the strategy steps (deterministic). Skipped entirely when
  // authority was denied, proving governance cannot be bypassed after planning.
  const stepOutcomes: StepOutcome[] = [];
  if (granted) {
    for (const step of plan.strategy.steps) {
      const at = tick(100);
      const failed = input.injectFailingStep === step.id;
      const status = failed ? "failed" : "succeeded";
      stepOutcomes.push({ stepId: step.id, label: step.label, status, mutated: step.mutates, at });
      // A committed mutation is recorded to the canonical journal (observable).
      if (step.mutates && status === "succeeded") {
        appendJournal({
          kind: "MutationCommitted",
          at,
          authorityId: authority.authorityId,
          decisionId: authority.decisionId,
          actorKind: intent.actor.kind,
          actorId: intent.actor.id,
          enterpriseId: intent.enterpriseId,
          summary: `${step.label} committed under governed execution`,
          detail: { stepId: step.id, objective: objective.id },
        });
      }
    }
  }
  phasesCompleted.push("execute");

  // C0-X.3 OBSERVE — assemble the six mandatory observation dimensions, drawing
  // on the canonical journal entries this execution produced.
  const completedAt = tick(50);
  const producedJournal = getJournal().filter((e) => e.seq > journalBefore);
  const decisions: string[] = [
    `Authority ${authority.outcome} for ${intent.kind} (${authority.signature}).`,
    ...authority.restrictions.map((r) => `Restriction: ${r}`),
  ];
  if (!granted) {
    decisions.push(
      `Denied by: ${authority.evidence.filter((e) => !e.supports).map((e) => e.ref).join(", ") || "constitution"}.`,
    );
  }
  const observation: ObservedEvidence = {
    what: granted
      ? `${stepOutcomes.length} step(s) executed for ${intent.kind}`
      : `Execution of ${intent.kind} was denied before any step ran`,
    why: `${objective.statement} — expected: ${objective.expectedOutcome}`,
    who: { kind: intent.actor.kind, id: intent.actor.id, label: intent.actor.label ?? null },
    which: [...authority.capabilities, intent.object?.objectType ?? intent.projection?.objectType ?? "object"],
    when: {
      startedAt,
      completedAt,
      steps: stepOutcomes.map((o) => ({ stepId: o.stepId, at: o.at })),
    },
    decisions,
    journalRefs: producedJournal.map((e) => e.seq),
  };
  phasesCompleted.push("observe");

  // C0-X.4 EVALUATE — objective evaluation, recorded permanently.
  const durationMs = clock - now;
  const evaluation = evaluate(granted, stepOutcomes, observation, durationMs, completedAt);
  appendJournal({
    kind: "EvidenceAttached",
    at: completedAt,
    authorityId: authority.authorityId,
    decisionId: authority.decisionId,
    actorKind: intent.actor.kind,
    actorId: intent.actor.id,
    enterpriseId: intent.enterpriseId,
    summary: `Evaluation attached: ${evaluation.outcome} (quality ${evaluation.quality.toFixed(2)})`,
    detail: { outcome: evaluation.outcome, risk: evaluation.risk },
  });
  phasesCompleted.push("evaluate");

  // C0-X.6 LEARN + OPTIMIZE — learning influences the future; optimization makes
  // a NEW strategy. Neither touches this or any prior record.
  const learnings = deriveLearnings(granted, stepOutcomes, evaluation);
  phasesCompleted.push("learn");
  const optimizedStrategy = granted ? optimizeStrategy(plan, stepOutcomes) : null;
  phasesCompleted.push("optimize");

  const status: ExecutionStatus = !granted
    ? "denied"
    : stepOutcomes.some((o) => o.status === "failed")
      ? "completed_with_failures"
      : "completed";

  const executionId = `gx_${stableHash({
    p: plan.planId,
    a: authority.authorityId,
    g: granted,
    s: stepOutcomes.map((o) => [o.stepId, o.status]),
    n: now,
    c: input.corrects ?? null,
  })}`;

  // The hash covers the full payload EXCEPT itself — tamper-evident (C0-X.5).
  const recordHash = stableHash({
    executionId,
    plan,
    authorityId: authority.authorityId,
    granted,
    stepOutcomes,
    observation,
    evaluation,
    learnings,
    optimizedStrategy,
    status,
  });

  const record: GovernedExecution = deepFreeze({
    executionId,
    intentKind: intent.kind,
    actor: { kind: intent.actor.kind, id: intent.actor.id, label: intent.actor.label ?? null },
    enterpriseId: intent.enterpriseId,
    objective,
    plan,
    authorityId: granted ? authority.authorityId : null,
    granted,
    stepOutcomes,
    observation,
    evaluation,
    learnings,
    optimizedStrategy,
    phasesCompleted,
    status,
    startedAt,
    completedAt,
    corrects: input.corrects ?? null,
    recordHash,
  });

  return appendExecution(record);
}
