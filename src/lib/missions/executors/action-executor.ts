// MS-011 — Governed Action Executor. A GENERIC mission task executor (not a
// business agent) that dispatches a task to the existing Mission Control action
// engine via executeAction(). Reusing executeAction means each task inherits the
// full governed pipeline — idempotency, permission, object-ACL, approval routing,
// audit, and runtime trace — with zero duplication. Fail-closed: any non-completed
// action status surfaces as a thrown error so the runtime fails/propagates rather
// than silently degrading.

import { executeAction } from "@/lib/mission-control/actions/action-service";
import {
  registerExecutor,
  type TaskExecutor,
  type TaskExecutionContext,
  type TaskExecutionResult,
} from "../executor-registry";

export const ACTION_EXECUTOR_KEY = "mission.action";

/** Task input contract for the governed action executor. */
export interface ActionTaskInput {
  /** Registered action key to execute (Mission Control action engine). */
  actionKey: string;
  /** Input payload passed to the action handler. */
  actionInput?: Record<string, unknown>;
  /** Optional object the action targets (drives object-level ACL). */
  object?: { type: string; id: string };
  /** Explicit policy exemption from approval (§56 #5). */
  approvalExempt?: boolean;
  /** Override the derived idempotency key. */
  idempotencyKey?: string;
}

function parseInput(raw: Record<string, unknown>): ActionTaskInput {
  const actionKey = raw.actionKey;
  if (typeof actionKey !== "string" || actionKey.length === 0) {
    throw new Error(`${ACTION_EXECUTOR_KEY}: task input requires a non-empty "actionKey"`);
  }
  return {
    actionKey,
    actionInput: (raw.actionInput as Record<string, unknown> | undefined) ?? {},
    object: raw.object as { type: string; id: string } | undefined,
    approvalExempt: raw.approvalExempt === true,
    idempotencyKey: typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : undefined,
  };
}

export const actionExecutor: TaskExecutor = {
  key: ACTION_EXECUTOR_KEY,
  async execute(c: TaskExecutionContext): Promise<TaskExecutionResult> {
    const a = parseInput(c.input);
    // Stable per-task idempotency key: completed actions dedupe (no double side
    // effect); failed/blocked do not dedupe, so retries re-run as expected.
    const idempotencyKey = a.idempotencyKey ?? `mission:${c.executionId}:${c.taskId}`;
    const exec = await executeAction(c.ctx, {
      actionKey: a.actionKey,
      input: a.actionInput ?? {},
      object: a.object,
      approvalExempt: a.approvalExempt,
      idempotencyKey,
    });

    switch (exec.status) {
      case "completed":
        return { output: { actionExecutionId: exec.id, result: exec.result ?? null } };
      case "awaiting_approval":
        // The action's own human gate is open. Mission tasks should model human
        // approval via the runtime's `requiresApproval`; surface this fail-closed.
        throw new Error(
          `action "${a.actionKey}" is awaiting approval (execution ${exec.id}); gate the mission task with requiresApproval`,
        );
      case "blocked":
        throw new Error(`action "${a.actionKey}" blocked: ${exec.blockedReason ?? "fail-closed"}`);
      default: {
        const err = (exec.result as { error?: unknown } | null)?.error;
        throw new Error(`action "${a.actionKey}" ${exec.status}: ${typeof err === "string" ? err : "failed"}`);
      }
    }
  },
};

/** Register the governed action executor (idempotent). Also self-registered on
 *  import so platform bootstrap wires it via a side-effect import. */
export function registerActionExecutor(): void {
  registerExecutor(actionExecutor);
}

registerActionExecutor();
