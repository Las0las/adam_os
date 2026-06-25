// Support seed pack (§51). Self-registers an object mapper and two functions,
// and exposes a support-triage agent + seed helper. Registration happens via
// side-effect imports of this module.

import { now } from "@/lib/lawrence-core/utils/ids";
import { registerFunction } from "@/lib/aiops/functions/function-registry";
import { registerObjectMapper } from "@/lib/dataops/ontology/object-mapper-registry";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { generateDraftResponse } from "@/lib/aiops/functions/builtins/generate-draft-response";
import type { LawrenceFunction, FunctionExecutionResult } from "@/lib/aiops/functions/function-types";
import type { ActorContext } from "@/types/platform";
import type { AgentDefinition } from "@/types/aiops";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

// ── Object mapper ───────────────────────────────────────────────────────
// Projects a CanonicalRecord payload {subject, description, priority} into a
// SupportTicket ontology object.
registerObjectMapper({
  key: "support",
  map(ctx: ActorContext, record: CanonicalRecord): OntologyObject[] {
    const p = record.payload;
    const subject = str(p.subject);
    const ticketId = str(p.ticket_id);
    if (!subject && !ticketId) return [];

    const ticket = upsertObject(ctx, {
      objectType: "SupportTicket",
      externalKey: ticketId ?? subject,
      title: subject ?? ticketId,
      status: "open",
      properties: {
        subject,
        description: str(p.description),
        priority: str(p.priority),
      },
    });
    return [ticket];
  },
});

// ── Functions ───────────────────────────────────────────────────────────
// Deterministic severity classifier.
type Severity = "p1" | "p2" | "p3" | "p4";
const classifyTicketSeverity: LawrenceFunction<
  { text: string },
  { severity: Severity; confidence: number }
> = {
  key: "classify_ticket_severity",
  name: "Classify ticket severity",
  description: "Deterministically classify a support ticket's severity from its text.",
  klass: "classify",
  outputSchema: {
    type: "object",
    properties: {
      severity: { type: "string", enum: ["p1", "p2", "p3", "p4"] },
      confidence: { type: "number" },
    },
    required: ["severity", "confidence"],
  },
  async run(_ctx, input): Promise<FunctionExecutionResult<{ severity: Severity; confidence: number }>> {
    const text = (input.text ?? "").toLowerCase();
    let severity: Severity;
    if (text.includes("outage") || text.includes("down") || text.includes("urgent")) {
      severity = "p1";
    } else if (text.includes("error") || text.includes("fail")) {
      severity = "p2";
    } else if (text.includes("question") || text.includes("how")) {
      severity = "p4";
    } else {
      severity = "p3";
    }
    return { output: { severity, confidence: 0.7 } };
  },
};
registerFunction(classifyTicketSeverity);

// Draft a support response by delegating to the built-in draft function.
const draftSupportResponse: LawrenceFunction<
  { ticketId: string; prompt: string },
  unknown
> = {
  key: "draft_support_response",
  name: "Draft support response",
  description: "Draft an evidence-grounded support response for a ticket.",
  klass: "draft",
  outputSchema: {
    type: "object",
    properties: { draft: { type: "string" }, citationCount: { type: "number" } },
    required: ["draft", "citationCount"],
  },
  async run(ctx, input): Promise<FunctionExecutionResult<unknown>> {
    return generateDraftResponse.run(ctx, {
      prompt: input.prompt,
      objectTypes: ["SupportTicket", "KnowledgeDocument"],
      subjectObjectId: input.ticketId,
    });
  },
};
registerFunction(draftSupportResponse);

// ── Agent ───────────────────────────────────────────────────────────────
/** A support-triage agent: retrieve KB, classify severity, answer with citations. */
export function supportTriageAgent(tenantId: string): AgentDefinition {
  return {
    id: "agent_support_triage",
    tenantId,
    key: "support_triage",
    name: "Support triage",
    description: "Retrieve knowledge, classify severity, and answer with citations.",
    status: "active",
    createdAt: now(),
    graph: {
      nodes: [
        { id: "in", kind: "input", config: {} },
        { id: "retrieve", kind: "retrieve", config: { objectTypes: ["KnowledgeDocument"], methods: ["rank_fusion"] } },
        { id: "classify", kind: "function", config: { functionKey: "classify_ticket_severity", input: {} } },
        { id: "answer", kind: "function", config: { functionKey: "answer_with_citations", input: {} } },
        { id: "out", kind: "output", config: {} },
      ],
      edges: [
        { from: "in", to: "retrieve" },
        { from: "retrieve", to: "classify" },
        { from: "classify", to: "answer" },
        { from: "answer", to: "out" },
      ],
    },
  };
}

// ── Seed ────────────────────────────────────────────────────────────────
/** Seed a knowledge document with evidence plus a support ticket. */
export function seedSupport(ctx: ActorContext): void {
  const doc = upsertObject(ctx, {
    objectType: "KnowledgeDocument",
    externalKey: "kb-1",
    title: "Password reset",
    properties: {},
  });
  indexEvidence(
    ctx,
    { objectType: "KnowledgeDocument", objectId: doc.id },
    "To reset a password, use the self-service portal and follow the email link.",
  );
  upsertObject(ctx, {
    objectType: "SupportTicket",
    externalKey: "t-1",
    title: "Cannot reset password",
    status: "open",
    properties: {},
  });
}
