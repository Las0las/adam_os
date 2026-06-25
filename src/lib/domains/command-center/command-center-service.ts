// Phase 4 — cross-domain Command Center aggregation (Part G). Pulls open work
// from every fabric and annotates each item with its domain, severity/status,
// linked object, and next action so one governed surface shows all domains.

import { db } from "@/lib/lawrence-core/db";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { CommandCenterItem } from "../domain-workflow-types";
import type { ActionExecution, ReviewCase, Notification, RuntimeIncident } from "@/types/mission-control";
import type { OntologyObject } from "@/types/dataops";
import type { AuditEvent } from "@/types/platform";

export interface CommandCenterOverview {
  actionQueue: ActionExecution[];
  reviewQueue: ReviewCase[];
  riskSignals: OntologyObject[];
  recommendations: OntologyObject[];
  notifications: Notification[];
  recentAuditEvents: AuditEvent[];
  runtimeIncidents: RuntimeIncident[];
  items: CommandCenterItem[];
}

const DOMAIN_BY_OBJECT_TYPE: Record<string, string> = {
  Candidate: "recruiting",
  Job: "recruiting",
  Submission: "recruiting",
  RecruiterNote: "recruiting",
  OnboardingCase: "onboarding",
  OnboardingTask: "onboarding",
  SupportTicket: "support",
  KnowledgeDocument: "support",
  SupportDraftResponse: "support",
  ValidationCase: "claims",
  ValidationFinding: "claims",
  ClaimDocument: "claims",
  EmailMessage: "claims",
  Account: "executive",
  Opportunity: "executive",
  RiskSignal: "executive",
  DecisionMemo: "executive",
};

/** Infer the owning domain from an object type or namespaced key. */
export function inferDomain(hint?: string | null): string {
  if (!hint) return "platform";
  if (DOMAIN_BY_OBJECT_TYPE[hint]) return DOMAIN_BY_OBJECT_TYPE[hint] as string;
  const prefix = hint.split(/[._:]/)[0];
  if (["recruiting", "onboarding", "support", "claims", "executive"].includes(prefix ?? "")) {
    return prefix as string;
  }
  return "platform";
}

export async function getCommandCenterOverview(ctx: ActorContext): Promise<CommandCenterOverview> {
  const OPEN_ACTION = ["queued", "running", "awaiting_approval", "blocked"];
  const OPEN_REVIEW = ["open", "in_review"];

  const actionQueue = (await db.actionExecutions.list(ctx.tenantId, (a) => OPEN_ACTION.includes(a.status)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviewQueue = (await db.reviewCases.list(ctx.tenantId, (c) => OPEN_REVIEW.includes(c.status)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const riskSignals = await listObjects(ctx, "RiskSignal");
  const recommendations = (await listObjects(ctx)).filter((o) =>
    ["DecisionMemo", "RecruiterNote", "SupportDraftResponse"].includes(o.objectType),
  );
  const notifications = (await db.notifications.list(ctx.tenantId)).slice(-25).reverse();
  const recentAuditEvents = (await listAudit(ctx.tenantId)).slice(0, 25);
  const runtimeIncidents = await db.runtimeIncidents.list(ctx.tenantId, (i) => i.status === "open");

  const items: CommandCenterItem[] = [];
  for (const a of actionQueue) {
    items.push({
      domain: inferDomain(a.objectType ?? a.actionId),
      kind: "action",
      title: a.actionId,
      severity: null,
      status: a.status,
      linkedObjectType: a.objectType ?? null,
      linkedObjectId: a.objectId ?? null,
      nextAction: a.status === "awaiting_approval" ? "approve_or_reject" : "monitor",
      createdAt: a.createdAt,
    });
  }
  for (const c of reviewQueue) {
    items.push({
      domain: inferDomain(c.subjectObjectType ?? c.caseType),
      kind: "review",
      title: c.summary ?? c.caseType,
      severity: c.severity ?? null,
      status: c.status,
      linkedObjectType: c.subjectObjectType ?? null,
      linkedObjectId: c.subjectObjectId ?? null,
      nextAction: "resolve_review",
      createdAt: c.createdAt,
    });
  }
  for (const r of riskSignals) {
    items.push({
      domain: "executive",
      kind: "risk",
      title: String(r.properties.riskType ?? r.title ?? "Risk"),
      severity: (r.properties.severity as CommandCenterItem["severity"]) ?? null,
      status: r.status ?? null,
      linkedObjectType: "RiskSignal",
      linkedObjectId: r.id,
      nextAction: "review_risk",
      createdAt: r.createdAt,
    });
  }
  for (const o of recommendations) {
    items.push({
      domain: inferDomain(o.objectType),
      kind: "recommendation",
      title: o.title ?? o.objectType,
      severity: null,
      status: o.status ?? null,
      linkedObjectType: o.objectType,
      linkedObjectId: o.id,
      nextAction: "act_on_recommendation",
      createdAt: o.createdAt,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    actionQueue,
    reviewQueue,
    riskSignals,
    recommendations,
    notifications,
    recentAuditEvents,
    runtimeIncidents,
    items,
  };
}
