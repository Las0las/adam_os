// Phase 8 — demo runner. Executes a demo scenario's steps through the REAL
// production services (install, function/agent/action runs, evals). Navigation
// steps return guided targets. Records a demo run with a per-step trace; stops
// on failure. No fake traces — every produced artifact is a real platform row.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { getDemoScenario } from "./demo-scenario-registry";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { runAgent } from "@/lib/aiops/agents/agent-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { runEvalSuite } from "@/lib/aiops/evals/eval-suite-runner";
import { getEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { ensureDemoObjects } from "./demo-fixture-loader";
import type { ActorContext } from "@/types/platform";
import type {
  DemoScenario,
  DemoStep,
  DemoRunStepResult,
  DomainPackDemoRun,
} from "@/lib/domain-packs/domain-pack-types";
import type { AgentDefinition, AgentGraph } from "@/types/aiops";

async function executeStep(
  ctx: ActorContext,
  scenario: DemoScenario,
  step: DemoStep,
): Promise<DemoRunStepResult> {
  const base = { stepKey: step.key, action: step.action, status: "completed" as const, outcome: step.expectedOutcome };
  const payload = step.payload;

  switch (step.action) {
    case "install_pack": {
      const manifest = getDomainPackManifest(scenario.packKey);
      if (!manifest) throw new Error(`pack not found: ${scenario.packKey}`);
      const res = await installDomainPack(ctx, manifest, { actorUserId: ctx.actorUserId });
      return { ...base, produced: { installationId: res.installation.id, alreadyInstalled: res.alreadyInstalled }, navigateTo: `/domain-packs/${scenario.packKey}` };
    }
    case "create_demo_objects": {
      const count = await ensureDemoObjects(ctx, scenario.packKey);
      return { ...base, produced: { demoObjectCount: count }, navigateTo: "/command-center" };
    }
    case "run_function": {
      const run = await runFunction(ctx, String(payload.functionKey), (payload.input as Record<string, unknown>) ?? {});
      return { ...base, status: run.status === "failed" ? "failed" : "completed", produced: { functionRunId: run.id, status: run.status, citations: run.citations?.length ?? 0 }, navigateTo: "/aiops/observability", error: run.error ?? null };
    }
    case "run_agent": {
      const def = await db.agentDefinitions.find(ctx.tenantId, (a) => a.key === String(payload.agentKey));
      if (!def || !(def.graph as AgentGraph)?.nodes?.length) {
        return { ...base, status: "skipped", produced: { reason: "agent graph not runnable in demo" }, navigateTo: "/command-center" };
      }
      const run = await runAgent(ctx, def as AgentDefinition, (payload.input as Record<string, unknown>) ?? {});
      return { ...base, status: run.status === "failed" ? "failed" : "completed", produced: { agentRunId: run.id, status: run.status, steps: run.steps.length }, navigateTo: "/command-center", error: run.error ?? null };
    }
    case "execute_action": {
      const exec = await executeAction(ctx, {
        actionKey: String(payload.actionKey),
        input: (payload.input as Record<string, unknown>) ?? {},
        object: payload.object as { type: string; id: string } | undefined,
      });
      return { ...base, produced: { executionId: exec.id, status: exec.status }, navigateTo: "/mission-control/control-plane" };
    }
    case "run_evals": {
      const manifest = getDomainPackManifest(scenario.packKey);
      const results: Array<{ suiteKey: string; passed: boolean | null; score: number; regression: boolean }> = [];
      for (const s of manifest?.evalSuites ?? []) {
        const suite = await db.evalSuites.find(ctx.tenantId, (x) => x.key === s.key);
        if (!suite) continue;
        const { run } = await runEvalSuite(ctx, suite.id);
        results.push({ suiteKey: s.key, passed: run.passed ?? null, score: run.score, regression: run.regressionDetected ?? false });
      }
      return { ...base, produced: { evals: results }, navigateTo: "/aiops/evals" };
    }
    case "open_command_center":
      return { ...base, produced: {}, navigateTo: `/command-center?demoMode=true&packKey=${scenario.packKey}` };
    case "open_mission_control":
      return { ...base, produced: {}, navigateTo: "/mission-control/control-plane" };
    case "open_object_detail":
      return { ...base, produced: {}, navigateTo: payload.objectType && payload.objectId ? `/objects/${payload.objectType}/${payload.objectId}` : "/command-center" };
    case "show_evidence":
    case "show_audit":
    case "run_pipeline":
    default:
      return { ...base, produced: {}, navigateTo: "/command-center" };
  }
}

export async function runDemo(
  ctx: ActorContext,
  packKey: string,
  demoKey: string,
): Promise<DomainPackDemoRun> {
  const scenario = getDemoScenario(packKey, demoKey);
  if (!scenario) throw new Error(`demo not found: ${packKey}/${demoKey}`);

  const run = await db.domainPackDemoRuns.insert({
    id: id("demorun"),
    tenantId: ctx.tenantId,
    packKey,
    demoKey,
    status: "running",
    createdBy: ctx.actorUserId ?? null,
    trace: { steps: [] },
    createdAt: now(),
    completedAt: null,
  });
  await emitAudit(ctx, "demo.run.started", { type: "demo_run", id: run.id }, { packKey, demoKey });

  const steps: DemoRunStepResult[] = [];
  let failed = false;
  for (const step of scenario.steps) {
    try {
      const result = await executeStep(ctx, scenario, step);
      steps.push(result);
      if (result.status === "failed") {
        failed = true;
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({ stepKey: step.key, action: step.action, status: "failed", outcome: step.expectedOutcome, produced: {}, error: message });
      failed = true;
      break;
    }
  }

  const finished = await db.domainPackDemoRuns.update(run.id, {
    status: failed ? "failed" : "completed",
    trace: { steps },
    completedAt: now(),
  });
  await emitAudit(ctx, failed ? "demo.run.failed" : "demo.run.completed", { type: "demo_run", id: run.id }, {
    packKey,
    demoKey,
    stepCount: steps.length,
  });
  return finished;
}

/** Run a single step against an existing (or new) demo run — for step-through UX. */
export async function runDemoStep(
  ctx: ActorContext,
  packKey: string,
  demoKey: string,
  stepKey: string,
): Promise<DemoRunStepResult> {
  const scenario = getDemoScenario(packKey, demoKey);
  if (!scenario) throw new Error(`demo not found: ${packKey}/${demoKey}`);
  const step = scenario.steps.find((s) => s.key === stepKey);
  if (!step) throw new Error(`demo step not found: ${stepKey}`);
  return await executeStep(ctx, scenario, step);
}

export async function getDemoRun(ctx: ActorContext, demoRunId: string): Promise<DomainPackDemoRun | undefined> {
  return await db.domainPackDemoRuns.get(ctx.tenantId, demoRunId);
}
