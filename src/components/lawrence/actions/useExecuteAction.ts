"use client";

// Phase 5 — governed action execution hook (Part D). Routes a CommandActionRef
// to the correct backend endpoint based on input.runKind and surfaces the real
// backend state. Never mutates objects locally — the UI refreshes from the
// backend after a result (Part D3).

import { useCallback, useState } from "react";
import type { CommandActionRef } from "@/lib/domains/command-center/command-center-types";

export type ActionState =
  | "idle"
  | "confirming"
  | "executing"
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "awaiting_review";

export interface ActionContext {
  objectType?: string;
  objectId?: string;
  reviewCaseId?: string;
}

export interface ExecuteResult {
  state: ActionState;
  raw?: unknown;
  message?: string;
}

function runKindOf(action: CommandActionRef): "action" | "function" | "review" {
  const k = (action.input?.runKind as string | undefined) ?? "action";
  return k === "function" || k === "review" ? k : "action";
}

function endpointFor(action: CommandActionRef, ctx: ActionContext): { url: string; body: unknown } {
  const kind = runKindOf(action);
  const input = { ...(action.input ?? {}) };
  delete (input as Record<string, unknown>).runKind;

  if (kind === "function") {
    return { url: `/api/aiops/functions/${encodeURIComponent(action.actionKey)}/run`, body: { input } };
  }
  if (kind === "review") {
    const caseId = (ctx.reviewCaseId ?? (input as Record<string, unknown>).reviewCaseId) as string;
    return {
      url: `/api/mission-control/review-cases/${encodeURIComponent(caseId)}/resolve`,
      body: { decision: input.decision, note: input.note },
    };
  }
  return {
    url: `/api/mission-control/actions/${encodeURIComponent(action.actionKey)}/execute`,
    body: {
      input,
      object: ctx.objectType && ctx.objectId ? { type: ctx.objectType, id: ctx.objectId } : undefined,
    },
  };
}

function stateFromResult(result: unknown): ActionState {
  const status =
    (result as { status?: string })?.status ??
    ((result as { data?: { status?: string } })?.data?.status as string | undefined);
  if (status === "completed") return "completed";
  if (status === "failed" || status === "blocked") return "failed";
  if (status === "awaiting_approval") return "awaiting_approval";
  if (status === "awaiting_review") return "awaiting_review";
  return "completed";
}

export function useExecuteAction(onSettled?: () => void) {
  const [state, setState] = useState<ActionState>("idle");
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const execute = useCallback(
    async (action: CommandActionRef, ctx: ActionContext): Promise<ExecuteResult> => {
      setState("executing");
      try {
        const { url, body } = endpointFor(action, ctx);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const raw = await res.json().catch(() => ({}));
        const next: ExecuteResult = res.ok
          ? { state: stateFromResult(raw), raw }
          : { state: "failed", raw, message: (raw as { error?: string })?.error ?? `HTTP ${res.status}` };
        setState(next.state);
        setResult(next);
        onSettled?.();
        return next;
      } catch (err) {
        const next: ExecuteResult = { state: "failed", message: err instanceof Error ? err.message : String(err) };
        setState("failed");
        setResult(next);
        return next;
      }
    },
    [onSettled],
  );

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
  }, []);

  return { state, result, execute, reset };
}
