// Action execution engine (§34–§35). Turns AI output / operational signals into
// controlled enterprise actions. Pipeline per execution:
//   idempotency -> permission -> precondition -> approval routing -> run -> audit
// Per §56 hard rule #5, customer-affecting actions require review or an explicit
// policy exemption (requiresApproval=false).

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { hasPermission } from "@/lib/lawrence-core/permissions/permissions";
import { openReviewCase } from "../review-queue/review-service";
import type { ActorContext, Permission } from "@/types/platform";
import type { ActionDefinition, ActionExecution } from "@/types/mission-control";

export interface ActionHandler {
  key: string;
  /** Permission required to execute. */
  requiredPermission?: Permission;
  /** If true, executions are gated by a review case unless exempted. */
  requiresApproval?: boolean;
  /** Returns null if preconditions pass, otherwise a block reason. */
  precondition?(ctx: ActorContext, input: Record<string, unknown>): string | null;
  run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

const handlers = new Map<string, ActionHandler>();

export function registerAction(handler: ActionHandler): void {
  handlers.set(handler.key, handler);
}

export function resolveAction(key: string): ActionHandler | undefined {
  return handlers.get(key);
}

export interface ExecuteActionInput {
  actionKey: string;
  input: Record<string, unknown>;
  object?: { type: string; id: string };
  idempotencyKey?: string;
  /** Explicit policy exemption from approval (§56 #5). */
  approvalExempt?: boolean;
}

export async function executeAction(
  ctx: ActorContext,
  input: ExecuteActionInput,
): Promise<ActionExecution> {
  const handler = handlers.get(input.actionKey);
  if (!handler) throw new Error(`Unknown action: ${input.actionKey}`);

  // Idempotency: return prior execution for the same key.
  if (input.idempotencyKey) {
    const prior = db.actionExecutions.find(
      ctx.tenantId,
      (e) => e.idempotencyKey === input.idempotencyKey,
    );
    if (prior) return prior;
  }

  const exec = db.actionExecutions.insert({
    id: id("aexec"),
    tenantId: ctx.tenantId,
    actionId: input.actionKey,
    objectType: input.object?.type ?? null,
    objectId: input.object?.id ?? null,
    input: input.input,
    result: null,
    status: "queued",
    idempotencyKey: input.idempotencyKey ?? null,
    blockedReason: null,
    reviewCaseId: null,
    createdAt: now(),
  });

  // Permission check.
  if (handler.requiredPermission && !hasPermission(ctx, handler.requiredPermission)) {
    return block(ctx, exec.id, `missing permission: ${handler.requiredPermission}`);
  }

  // Precondition check.
  const reason = handler.precondition?.(ctx, input.input) ?? null;
  if (reason) return block(ctx, exec.id, reason);

  // Approval routing: open a review case and block until approved.
  if (handler.requiresApproval && !input.approvalExempt) {
    const rc = openReviewCase(ctx, {
      caseType: `action:${input.actionKey}`,
      subject: input.object,
      severity: "medium",
      summary: `Approval required for action ${input.actionKey}`,
      gatedActionExecutionId: exec.id,
    });
    const blocked = db.actionExecutions.update(exec.id, {
      status: "blocked",
      blockedReason: "awaiting approval",
      reviewCaseId: rc.id,
    });
    emitAudit(ctx, "action.blocked", { type: "action_execution", id: exec.id }, { reviewCaseId: rc.id });
    return blocked;
  }

  return runHandler(ctx, handler, exec.id, input.input);
}

/** Release a previously approved, review-gated action and run it. */
export async function releaseApprovedAction(
  ctx: ActorContext,
  reviewCaseId: string,
): Promise<ActionExecution | null> {
  const exec = db.actionExecutions.find(ctx.tenantId, (e) => e.reviewCaseId === reviewCaseId);
  if (!exec || exec.status !== "blocked") return null;
  const handler = handlers.get(exec.actionId);
  if (!handler) return null;
  return runHandler(ctx, handler, exec.id, exec.input);
}

async function runHandler(
  ctx: ActorContext,
  handler: ActionHandler,
  execId: string,
  actionInput: Record<string, unknown>,
): Promise<ActionExecution> {
  db.actionExecutions.update(execId, { status: "running" });
  try {
    const result = await handler.run(ctx, actionInput);
    const completed = db.actionExecutions.update(execId, { status: "completed", result });
    emitAudit(ctx, "action.completed", { type: "action_execution", id: execId }, { actionKey: handler.key });
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = db.actionExecutions.update(execId, { status: "failed", result: { error: message } });
    emitAudit(ctx, "action.failed", { type: "action_execution", id: execId }, { error: message });
    return failed;
  }
}

function block(ctx: ActorContext, execId: string, reason: string): ActionExecution {
  const blocked = db.actionExecutions.update(execId, { status: "blocked", blockedReason: reason });
  emitAudit(ctx, "action.blocked", { type: "action_execution", id: execId }, { reason });
  return blocked;
}

/** Register an action definition row (metadata for Studio/API surfaces). */
export function defineAction(
  ctx: ActorContext,
  input: { key: string; name: string; objectType?: string; requiredPermission?: string },
): ActionDefinition {
  return db.actionDefinitions.insert({
    id: id("adef"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    objectType: input.objectType ?? null,
    inputSchema: {},
    approvalPolicyId: null,
    requiredPermission: input.requiredPermission ?? null,
    createdAt: now(),
  });
}
