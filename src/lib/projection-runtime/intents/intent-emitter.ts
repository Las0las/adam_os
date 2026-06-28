// IntentEmitter — the ONLY way a surface causes a change. A button never mutates
// a record; it emits a governed domain intent here. Emission routes through the
// existing Mission Control action engine endpoint, so the full governance
// pipeline (idempotency → permission → object ACL → precondition → approval →
// run → audit) applies. This deliberately reuses the existing command framework
// rather than introducing a parallel one.

import type { ResolvedIntent } from "../contracts/universal-projection";

export type IntentState =
  | "completed"
  | "failed"
  | "blocked"
  | "awaiting_approval"
  | "awaiting_review";

export interface IntentEmissionResult {
  state: IntentState;
  /** The result id of the affected object, if the handler returned one. */
  resultId?: string;
  raw?: unknown;
  message?: string;
}

function deriveState(raw: unknown): IntentState {
  const status =
    (raw as { status?: string })?.status ??
    ((raw as { data?: { status?: string } })?.data?.status as string | undefined);
  if (status === "failed") return "failed";
  if (status === "blocked") return "blocked";
  if (status === "awaiting_approval") return "awaiting_approval";
  if (status === "awaiting_review") return "awaiting_review";
  return "completed";
}

/** Pull a result object id out of the action execution result, if present. */
function deriveResultId(raw: unknown): string | undefined {
  const result = (raw as { result?: Record<string, unknown> })?.result;
  if (!result) return undefined;
  const candidate =
    result.candidateId ?? result.objectId ?? result.id ?? result.submissionId ?? result.noteId;
  return candidate == null ? undefined : String(candidate);
}

/**
 * Emit a governed domain intent with a payload. The payload is the canonical
 * upsert/values bag the action handler expects. `object` is the target ref for
 * update/transition/delete intents (omitted for create).
 */
export async function emitIntent(
  intent: ResolvedIntent,
  payload: Record<string, unknown>,
  object?: { type: string; id: string },
): Promise<IntentEmissionResult> {
  try {
    const res = await fetch(
      `/api/mission-control/actions/${encodeURIComponent(intent.actionKey)}/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: payload, object }),
      },
    );
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        state: "failed",
        raw,
        message: (raw as { error?: string })?.error ?? `HTTP ${res.status}`,
      };
    }
    return { state: deriveState(raw), resultId: deriveResultId(raw), raw };
  } catch (err) {
    return { state: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
