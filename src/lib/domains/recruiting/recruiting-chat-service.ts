// Conversational update path (slice B). A recruiter types a natural-language
// command ("move Dana to interview", "add a note on Sam", or pastes a profile).
// A model classifies the intent + extracts parameters; the service then resolves
// the target candidate and routes to a GOVERNED action — never a direct mutation:
//
//   - advance_stage   -> executeAction("advance_candidate_stage")  (approval-gated)
//   - add_note        -> executeAction("recruiting.create_recruiter_note")
//   - create_candidate-> extractCandidateDraft (paste -> draft -> review, slice A)
//
// All permission/approval/idempotency/audit checks live in executeAction and the
// extraction service. Ambiguous or unresolved targets do nothing and ask to
// clarify, so a fuzzy message can never silently mutate the wrong record.

import { id } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { resolveModelProvider } from "@/lib/aiops/models/model-router";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { extractCandidateDraft } from "@/lib/dataops/import/nl/candidate-extraction";
import { normalizeStage } from "@/lib/dataops/import/recruiting-ir";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";
import type { ActionExecution } from "@/types/mission-control";
// Side-effect: ensure the governed recruiting actions are registered.
import "./recruiting-pack";
import "./recruiting-actions";

const INTENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    intent: { type: "string" }, // advance_stage | add_note | create_candidate | unknown
    candidate: { type: "string" }, // name / email used to find the candidate
    toStage: { type: "string" }, // target stage for advance_stage
    note: { type: "string" }, // note body for add_note
  },
};

// Stages a candidate can be advanced to (matches the action's precondition).
const ADVANCEABLE = new Set(["screen", "submitted", "interview", "offer", "placed", "rejected"]);
const SUPPORTED =
  'I can: move a candidate to a stage ("move Dana to interview"), add a note ' +
  '("note on Sam: strong backend"), or create a candidate from a pasted profile.';

export type ChatCommandStatus =
  | "executed"
  | "pending_approval"
  | "draft"
  | "needs_clarification"
  | "blocked"
  | "unsupported";

export interface ChatCommandResult {
  intent: string;
  status: ChatCommandStatus;
  message: string;
  candidateId?: string;
  reviewCaseId?: string;
  executionId?: string;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export interface ChatCommandInput {
  message: string;
}

export async function runRecruitingChatCommand(
  ctx: ActorContext,
  input: ChatCommandInput,
): Promise<ChatCommandResult> {
  const text = input.message?.trim() ?? "";
  if (!text) throw new Error("empty message");

  // Honor a tenant's authorized chat model (per-purpose routing); falls back to
  // the process-default provider (the deterministic mock until a key is set).
  const provider = await resolveModelProvider(ctx, "chat");
  const completion = await provider.complete({
    prompt:
      "Classify this recruiting assistant message into one intent and extract its " +
      'parameters as JSON. intent is one of "advance_stage", "add_note", ' +
      '"create_candidate", or "unknown". For advance_stage set candidate + toStage; ' +
      "for add_note set candidate + note. Use only what the message states.\n\n" + text,
    outputSchema: INTENT_SCHEMA,
  });
  const parsed = completion.json ?? {};
  const intent = (str(parsed.intent) ?? "unknown").toLowerCase();

  // Audit the interpreted command before any routing (the action/extraction it
  // routes to emits its own audit too).
  await emitAudit(ctx, "recruiting.chat.command", { type: "chat_command", id: id("chatcmd") }, { intent });

  switch (intent) {
    case "advance_stage":
      return advanceStage(ctx, parsed);
    case "add_note":
      return addNote(ctx, parsed);
    case "create_candidate":
      return createCandidate(ctx, text);
    default:
      return { intent: "unknown", status: "unsupported", message: SUPPORTED };
  }
}

/** Case-insensitive match of a free-text reference against Candidate name/email/key. */
async function resolveCandidates(ctx: ActorContext, query: string): Promise<OntologyObject[]> {
  const q = query.toLowerCase();
  const all = await listObjects(ctx, "Candidate");
  return all.filter((c) => {
    const name = String(c.properties.fullName ?? c.title ?? "").toLowerCase();
    const email = String(c.properties.email ?? "").toLowerCase();
    const key = String(c.externalKey ?? "").toLowerCase();
    return name.includes(q) || email.includes(q) || key.includes(q);
  });
}

/** Resolve to exactly one candidate, or a clarification result describing why not. */
async function pickCandidate(
  ctx: ActorContext,
  intent: string,
  ref: string | null,
): Promise<{ candidate: OntologyObject } | { clarify: ChatCommandResult }> {
  if (!ref) {
    return { clarify: { intent, status: "needs_clarification", message: "Which candidate? Please name them." } };
  }
  const matches = await resolveCandidates(ctx, ref);
  if (matches.length === 0) {
    return { clarify: { intent, status: "needs_clarification", message: `No candidate found matching "${ref}".` } };
  }
  if (matches.length > 1) {
    const names = matches.slice(0, 5).map((c) => c.title ?? c.externalKey).join(", ");
    return {
      clarify: {
        intent,
        status: "needs_clarification",
        message: `Multiple candidates match "${ref}": ${names}. Please be more specific.`,
      },
    };
  }
  return { candidate: matches[0]! };
}

function describe(intent: string, candidateId: string, exec: ActionExecution): ChatCommandResult {
  const base = { intent, candidateId, executionId: exec.id };
  switch (exec.status) {
    case "completed":
      return { ...base, status: "executed", message: "Done." };
    case "awaiting_approval":
      return {
        ...base,
        status: "pending_approval",
        message: `Submitted for approval${exec.reviewCaseId ? ` (review ${exec.reviewCaseId})` : ""}.`,
        reviewCaseId: exec.reviewCaseId ?? undefined,
      };
    case "blocked":
      return { ...base, status: "blocked", message: `Blocked: ${exec.blockedReason ?? "not permitted"}.` };
    default:
      return { ...base, status: "blocked", message: `Action ${exec.status}.` };
  }
}

async function advanceStage(ctx: ActorContext, parsed: Record<string, unknown>): Promise<ChatCommandResult> {
  const intent = "advance_stage";
  const picked = await pickCandidate(ctx, intent, str(parsed.candidate));
  if ("clarify" in picked) return picked.clarify;

  const toStage = normalizeStage(str(parsed.toStage));
  if (!ADVANCEABLE.has(toStage)) {
    return {
      intent,
      status: "needs_clarification",
      message: `Which stage? Use one of: ${[...ADVANCEABLE].join(", ")}.`,
      candidateId: picked.candidate.id,
    };
  }

  // Governed: advance_candidate_stage requires review.reviewer + approval; the
  // gate is enforced inside executeAction, not here.
  const exec = await executeAction(ctx, {
    actionKey: "advance_candidate_stage",
    input: { candidateId: picked.candidate.id, toStage },
    object: { type: "Candidate", id: picked.candidate.id },
  });
  return describe(intent, picked.candidate.id, exec);
}

async function addNote(ctx: ActorContext, parsed: Record<string, unknown>): Promise<ChatCommandResult> {
  const intent = "add_note";
  const note = str(parsed.note);
  if (!note) {
    return { intent, status: "needs_clarification", message: "What should the note say?" };
  }
  const picked = await pickCandidate(ctx, intent, str(parsed.candidate));
  if ("clarify" in picked) return picked.clarify;

  const exec = await executeAction(ctx, {
    actionKey: "recruiting.create_recruiter_note",
    input: { candidateId: picked.candidate.id, note },
    object: { type: "Candidate", id: picked.candidate.id },
  });
  return describe(intent, picked.candidate.id, exec);
}

async function createCandidate(ctx: ActorContext, text: string): Promise<ChatCommandResult> {
  // Reuse the slice-A draft-to-review path: pasted text never auto-commits.
  const { extraction, reviewCase, proposed, confidence } = await extractCandidateDraft(ctx, {
    text,
    source: "chat",
  });
  return {
    intent: "create_candidate",
    status: "draft",
    message: `Drafted candidate "${proposed.fullName ?? proposed.externalKey}" (confidence ${confidence}) — pending review (case ${reviewCase.id}).`,
    candidateId: extraction.id,
    reviewCaseId: reviewCase.id,
  };
}
