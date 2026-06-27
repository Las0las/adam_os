// MS-010 — Agent Dispatcher: executor registry. Provides interfaces, registration,
// dispatch, and lifecycle hooks ONLY. No concrete agents/executors ship here.

import type { ActorContext } from "@/types/platform";

export interface TaskExecutionContext {
  ctx: ActorContext;
  missionId: string;
  executionId: string;
  taskId: string;
  input: Record<string, unknown>;
  /** 1-based attempt number (increments on retry). */
  attempt: number;
}

export interface TaskExecutionResult {
  output?: Record<string, unknown>;
}

/** A registered executor. `execute` does the work; the optional lifecycle hooks
 *  are invoked by the dispatcher. Implementations live outside this module. */
export interface TaskExecutor {
  key: string;
  execute(input: TaskExecutionContext): TaskExecutionResult | Promise<TaskExecutionResult>;
  onStart?(input: TaskExecutionContext): void | Promise<void>;
  onComplete?(input: TaskExecutionContext, result: TaskExecutionResult): void | Promise<void>;
  onError?(input: TaskExecutionContext, error: Error): void | Promise<void>;
}

const EXECUTORS = new Map<string, TaskExecutor>();

export function registerExecutor(executor: TaskExecutor): void {
  EXECUTORS.set(executor.key, executor);
}

export function getExecutor(key: string): TaskExecutor | undefined {
  return EXECUTORS.get(key);
}

export function listExecutors(): TaskExecutor[] {
  return [...EXECUTORS.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Clear all registered executors (test isolation). */
export function clearExecutors(): void {
  EXECUTORS.clear();
}
