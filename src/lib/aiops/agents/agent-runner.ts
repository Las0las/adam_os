// Agent runtime (§28–§30). Executes a directed agent graph node-by-node,
// threading a shared blackboard. Node kinds: input, retrieve, function,
// condition, action, review, notify, output. Each step is persisted for the
// run trace (§43).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { retrieve } from "../retrieval/retrieval-service";
import { runFunction } from "../functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { assertNotKilled } from "@/lib/mission-control/runtime/kill-switch-guard";
import {
  countRecentFailures,
  maybeRaiseFailureIncident,
} from "@/lib/mission-control/runtime/failure-threshold";
import { createRuntimeTrace } from "@/lib/aiops/observability/runtime-trace-service";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition, AgentNode, AgentRun, AgentRunStep } from "@/types/aiops";

type Blackboard = Record<string, unknown>;

export async function runAgent(
  ctx: ActorContext,
  agent: AgentDefinition,
  input: Record<string, unknown>,
): Promise<AgentRun> {
  requirePermission(ctx, "aiops.agent_admin");
  // Fail-closed: refuse to run a kill-switched agent.
  await assertNotKilled({ tenantId: ctx.tenantId, componentType: "agent", componentKey: agent.key });
  const run = await db.agentRuns.insert({
    id: id("arun"),
    tenantId: ctx.tenantId,
    agentId: agent.key,
    input,
    output: null,
    status: "running",
    steps: [],
    traceId: null,
    error: null,
    createdAt: now(),
  });

  const blackboard: Blackboard = { ...input };
  const steps: AgentRunStep[] = [];
  const nodesById = new Map(agent.graph.nodes.map((n) => [n.id, n]));

  try {
    let current = agent.graph.nodes.find((n) => n.kind === "input") ?? agent.graph.nodes[0];
    const guard = new Set<string>();
    while (current) {
      if (guard.has(current.id)) throw new Error(`Cycle detected at node ${current.id}`);
      guard.add(current.id);

      const startedAt = now();
      const output = await executeNode(ctx, current, blackboard);
      steps.push({
        nodeId: current.id,
        kind: current.kind,
        input: { ...blackboard },
        output,
        startedAt,
        finishedAt: now(),
      });
      Object.assign(blackboard, output);

      if (current.kind === "output") break;
      current = nextNode(agent, current, blackboard, nodesById);
    }

    const completed = await db.agentRuns.update(run.id, {
      status: "completed",
      steps,
      output: blackboard,
    });
    await emitAudit(ctx, "aiops.agent.run", { type: "agent_run", id: run.id }, { agentKey: agent.key });
    await createRuntimeTrace(ctx, {
      traceType: "agent_run",
      traceId: run.id,
      componentType: "agent",
      componentKey: agent.key,
      status: "completed",
      metrics: { nodeCount: steps.length, failedNodeCount: 0 },
      outputSummary: { keys: Object.keys(blackboard).slice(0, 12) },
    });
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.agentRuns.update(run.id, { status: "failed", steps, error: message });
    await emitAudit(ctx, "aiops.agent.run.failed", { type: "agent_run", id: run.id }, { error: message });
    await createRuntimeTrace(ctx, {
      traceType: "agent_run",
      traceId: run.id,
      componentType: "agent",
      componentKey: agent.key,
      status: "failed",
      metrics: { nodeCount: steps.length },
      errors: [message],
    });
    const runs = await db.agentRuns.list(ctx.tenantId, (r) => r.agentId === agent.key);
    const recentFailures = countRecentFailures(runs, (r) => r.status === "failed");
    await maybeRaiseFailureIncident(ctx, { componentType: "agent", componentKey: agent.key, recentFailures });
    return failed;
  }
}

async function executeNode(
  ctx: ActorContext,
  node: AgentNode,
  bb: Blackboard,
): Promise<Record<string, unknown>> {
  const cfg = node.config;
  switch (node.kind) {
    case "input":
    case "output":
      return {};
    case "retrieve": {
      const response = await retrieve(ctx, {
        tenantId: ctx.tenantId,
        query: String(cfg.query ?? bb.query ?? ""),
        objectTypes: cfg.objectTypes as string[] | undefined,
        methods: (cfg.methods as never) ?? ["rank_fusion"],
        limit: (cfg.limit as number) ?? 6,
      });
      return { retrieval: response };
    }
    case "function": {
      const fnRun = await runFunction(ctx, String(cfg.functionKey), {
        ...(cfg.input as Record<string, unknown>),
        ...(bb as Record<string, unknown>),
      });
      return { [`fn_${cfg.functionKey}`]: fnRun.output, lastFunctionRun: fnRun };
    }
    case "condition":
      // Condition nodes are evaluated during edge selection; no state change.
      return {};
    case "action": {
      const exec = await executeAction(ctx, {
        actionKey: String(cfg.actionKey),
        input: (cfg.input as Record<string, unknown>) ?? {},
        object: cfg.object as { type: string; id: string } | undefined,
      });
      return { lastAction: exec };
    }
    case "review": {
      const rc = await openReviewCase(ctx, {
        caseType: String(cfg.caseType ?? "agent_review"),
        severity: (cfg.severity as never) ?? "medium",
        summary: String(cfg.summary ?? ""),
      });
      return { lastReviewCase: rc };
    }
    case "notify": {
      const notes = await emitEvent(
        ctx,
        String(cfg.eventKey),
        String(cfg.recipientUserId ?? ctx.actorUserId ?? "system"),
        bb as Record<string, unknown>,
        cfg.deepLink as string | undefined,
      );
      return { lastNotifications: notes };
    }
    default:
      return {};
  }
}

function nextNode(
  agent: AgentDefinition,
  current: AgentNode,
  bb: Blackboard,
  nodesById: Map<string, AgentNode>,
): AgentNode | undefined {
  const outgoing = agent.graph.edges.filter((e) => e.from === current.id);
  for (const edge of outgoing) {
    if (!edge.condition || evalCondition(edge.condition, bb)) {
      return nodesById.get(edge.to);
    }
  }
  return undefined;
}

/** Minimal safe condition evaluator: "path.to.value == literal" forms only. */
function evalCondition(condition: string, bb: Blackboard): boolean {
  const m = condition.match(/^\s*([\w.]+)\s*(==|!=|>|<|>=|<=)\s*(.+?)\s*$/);
  if (!m) return Boolean(resolvePath(bb, condition));
  const [, path, op, rawLiteral] = m;
  const left = resolvePath(bb, path!);
  const right = parseLiteral(rawLiteral!);
  switch (op) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return Number(left) > Number(right);
    case "<":
      return Number(left) < Number(right);
    case ">=":
      return Number(left) >= Number(right);
    case "<=":
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function parseLiteral(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw.replace(/^['"]|['"]$/g, "");
}
