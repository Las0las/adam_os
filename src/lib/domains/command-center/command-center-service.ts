// Phase 5 — Command Center aggregation service (Part A2). Normalizes every
// fabric's open work into ranked CommandCenterItem queues, mode-aware.

import { db } from "@/lib/lawrence-core/db";
import { listAudit } from "@/lib/lawrence-core/audit/audit-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { now } from "@/lib/lawrence-core/utils/ids";
import { availableActionsForObject } from "@/lib/domains/object-detail/available-actions";
import { rankItems } from "./command-center-rankers";
import { inferDomain } from "./command-center-domain";
import { checkObjectAccessForActor } from "@/lib/security/access-guard";
import type { ActorContext } from "@/types/platform";
import type {
  CommandCenterItem,
  CommandCenterOverview,
  CommandDomain,
  CommandItemStatus,
  CommandSeverity,
  SurfaceMode,
} from "./command-center-types";

export { inferDomain } from "./command-center-domain";

const ACTION_STATUS: Record<string, CommandItemStatus> = {
  queued: "open",
  running: "in_progress",
  completed: "completed",
  failed: "failed",
  blocked: "blocked",
  awaiting_approval: "awaiting_approval",
};

const REVIEW_STATUS: Record<string, CommandItemStatus> = {
  open: "open",
  in_review: "awaiting_review",
  approved: "completed",
  rejected: "completed",
  resolved: "completed",
};

const INCIDENT_STATUS: Record<string, CommandItemStatus> = {
  open: "open",
  acknowledged: "in_progress",
  resolved: "completed",
};

function asSeverity(value: unknown): CommandSeverity | null {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : null;
}

export interface OverviewOptions {
  mode?: SurfaceMode;
  /** Phase 8 — restrict the overview to a pack's demo objects only. */
  demoMode?: boolean;
  packKey?: string;
}

export async function getCommandCenterOverview(
  ctx: ActorContext,
  opts: OverviewOptions = {},
): Promise<CommandCenterOverview> {
  const mode: SurfaceMode = opts.mode ?? "executive";
  const referenceTime = now();
  const rank = (items: CommandCenterItem[]) => rankItems(items, { mode, referenceTime });

  // §D object-level authorization — drop any item referencing an object the
  // caller cannot read. Items without an objectRef are already tenant-scoped.
  // Fail-closed: an errored access check suppresses the item.
  const filterAccessible = async (items: CommandCenterItem[]): Promise<CommandCenterItem[]> => {
    const out: CommandCenterItem[] = [];
    for (const it of items) {
      if (!it.objectRef) {
        out.push(it);
        continue;
      }
      try {
        const decision = await checkObjectAccessForActor(ctx, {
          objectType: it.objectRef.objectType,
          objectId: it.objectRef.objectId,
          permission: "read",
          objectTenantId: ctx.tenantId,
        });
        if (decision.allowed) out.push(it);
      } catch {
        // suppressed
      }
    }
    return out;
  };

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = await db.actionExecutions.list(ctx.tenantId);
  const actionItems: CommandCenterItem[] = actions
    .filter((a) => ["queued", "running", "awaiting_approval", "blocked", "failed"].includes(a.status))
    .map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      domain: inferDomain(a.objectType ?? a.actionId),
      kind: "action",
      title: a.actionId,
      summary: a.blockedReason ?? null,
      status: ACTION_STATUS[a.status] ?? "open",
      severity: a.status === "failed" ? "high" : null,
      priorityScore: 0,
      objectRef: a.objectType && a.objectId ? { objectType: a.objectType, objectId: a.objectId } : null,
      actions: [],
      createdAt: a.createdAt,
      metadata: { reviewCaseId: a.reviewCaseId ?? null },
    }));

  // ── Reviews ────────────────────────────────────────────────────────────
  const reviews = await db.reviewCases.list(ctx.tenantId, (c) =>
    ["open", "in_review"].includes(c.status),
  );
  const reviewItems: CommandCenterItem[] = reviews.map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    domain: inferDomain(c.subjectObjectType ?? c.caseType),
    kind: "review",
    title: c.summary ?? c.caseType,
    summary: c.caseType,
    status: REVIEW_STATUS[c.status] ?? "open",
    severity: asSeverity(c.severity),
    priorityScore: 0,
    objectRef:
      c.subjectObjectType && c.subjectObjectId
        ? { objectType: c.subjectObjectType, objectId: c.subjectObjectId }
        : null,
    actions: availableActionsForObject("ReviewCase").map((act) => ({
      ...act,
      input: { ...act.input, reviewCaseId: c.id },
    })),
    createdAt: c.createdAt,
  }));

  // ── Risks + recommendations (ontology objects) ───────────────────────────
  const riskObjects = await listObjects(ctx, "RiskSignal");
  const riskItems: CommandCenterItem[] = riskObjects.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    domain: "executive",
    kind: "risk",
    title: String(r.properties.riskType ?? r.title ?? "Risk"),
    summary: String(r.properties.rationale ?? ""),
    status: r.status === "dismissed" ? "completed" : "open",
    severity: asSeverity(r.properties.severity),
    priorityScore: 0,
    objectRef: { objectType: "RiskSignal", objectId: r.id, title: r.title },
    actions: availableActionsForObject("RiskSignal"),
    createdAt: r.createdAt,
  }));

  const recObjects = (await listObjects(ctx)).filter((o) =>
    ["DecisionMemo", "RecruiterNote", "SupportDraftResponse"].includes(o.objectType),
  );
  const recItems: CommandCenterItem[] = recObjects.map((o) => ({
    id: o.id,
    tenantId: o.tenantId,
    domain: inferDomain(o.objectType),
    kind: "recommendation",
    title: o.title ?? o.objectType,
    summary: String(o.properties.summary ?? ""),
    status: "open",
    severity: null,
    priorityScore: 0,
    objectRef: { objectType: o.objectType, objectId: o.id, title: o.title },
    actions: availableActionsForObject(o.objectType),
    createdAt: o.createdAt,
  }));

  // ── Notifications + incidents + audit ────────────────────────────────────
  const notifications = await db.notifications.list(ctx.tenantId);
  const notifItems: CommandCenterItem[] = notifications.slice(-30).map((n) => ({
    id: n.id,
    tenantId: n.tenantId,
    domain: inferDomain(n.title),
    kind: "notification",
    title: n.title,
    summary: n.body,
    status: n.state === "failed" ? "failed" : "completed",
    severity: n.state === "failed" ? "medium" : null,
    priorityScore: 0,
    createdAt: n.createdAt,
  }));

  const incidents = await db.runtimeIncidents.list(ctx.tenantId, (i) => i.status !== "resolved");
  const incidentItems: CommandCenterItem[] = incidents.map((i) => ({
    id: i.id,
    tenantId: i.tenantId,
    domain: "mission_control",
    kind: "incident",
    title: i.title,
    summary: i.detail ?? null,
    status: INCIDENT_STATUS[i.status] ?? "open",
    severity: asSeverity(i.severity),
    priorityScore: 0,
    createdAt: i.createdAt,
  }));

  // ── Learning signals (Phase 7) ───────────────────────────────────────────
  // Open critical/high signals surface as risks; accepted signals as
  // recommendations; repeated-failure signals into the mission-control queue.
  const learningSignals = await db.learningSignals.list(ctx.tenantId);
  const learningRiskItems: CommandCenterItem[] = learningSignals
    .filter((s) => s.status === "open" && (s.severity === "critical" || s.severity === "high"))
    .map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      domain: (s.domain as CommandDomain) ?? "mission_control",
      kind: "learning_signal",
      title: `Learning signal: ${s.signalType}`,
      summary: s.summary,
      status: "open",
      severity: s.severity,
      priorityScore: 0,
      createdAt: s.createdAt,
      metadata: { signalType: s.signalType, signalStatus: s.status },
    }));
  const learningRecItems: CommandCenterItem[] = learningSignals
    .filter((s) => s.status === "accepted")
    .map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      domain: (s.domain as CommandDomain) ?? "mission_control",
      kind: "learning_signal",
      title: `Accepted change: ${s.signalType}`,
      summary: s.summary,
      status: "in_progress",
      severity: s.severity,
      priorityScore: 0,
      createdAt: s.createdAt,
      metadata: { signalType: s.signalType, signalStatus: s.status },
    }));
  const learningIncidentItems: CommandCenterItem[] = learningSignals
    .filter((s) => s.status === "open" && (s.signalType === "action_failure" || s.signalType === "action_success"))
    .map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      domain: "mission_control",
      kind: "learning_signal",
      title: `Runtime learning: ${s.signalType}`,
      summary: s.summary,
      status: "open",
      severity: s.severity,
      priorityScore: 0,
      createdAt: s.createdAt,
      metadata: { signalType: s.signalType },
    }));

  const audit = (await listAudit(ctx.tenantId)).slice(0, 30);
  const auditItems: CommandCenterItem[] = audit.map((e) => ({
    id: e.id,
    tenantId: e.tenantId,
    domain: inferDomain(e.subjectType ?? e.action),
    kind: "audit",
    title: e.action,
    summary: e.subjectType ? `${e.subjectType} ${e.subjectId ?? ""}`.trim() : null,
    status: "completed",
    severity: null,
    priorityScore: 0,
    objectRef: e.subjectType && e.subjectId ? { objectType: e.subjectType, objectId: e.subjectId } : null,
    createdAt: e.createdAt,
  }));

  const metrics = {
    openActions: actionItems.filter((i) => ["open", "in_progress"].includes(i.status)).length,
    openReviews: reviewItems.length,
    criticalRisks: riskItems.filter((i) => i.severity === "critical" && i.status !== "completed").length,
    blockedWork: actionItems.filter((i) => i.status === "blocked").length,
    pendingApprovals: actionItems.filter((i) => i.status === "awaiting_approval").length,
    failedRuntimeItems:
      actionItems.filter((i) => i.status === "failed").length +
      notifItems.filter((i) => i.status === "failed").length,
  };

  // Phase 8 — demo mode: show only the selected pack's demo objects + work
  // scoped to them. Live action behavior is preserved; nothing is faked.
  if (opts.demoMode && opts.packKey) {
    const packKey = opts.packKey;
    const demoObjects = (await listObjects(ctx)).filter(
      (o) => o.properties.__demo === true && o.properties.__packKey === packKey,
    );
    const demoIds = new Set(demoObjects.map((o) => o.id));
    const keepDemo = (items: CommandCenterItem[]) =>
      items.filter((i) => i.objectRef && demoIds.has(i.objectRef.objectId));
    const demoObjectItems: CommandCenterItem[] = demoObjects.map((o) => ({
      id: o.id,
      tenantId: o.tenantId,
      domain: inferDomain(o.objectType),
      kind: "recommendation",
      title: o.title ?? o.objectType,
      summary: `DEMO ${o.objectType}`,
      status: "open",
      severity: null,
      priorityScore: 0,
      objectRef: { objectType: o.objectType, objectId: o.id, title: o.title },
      createdAt: o.createdAt,
      metadata: { demo: true, packKey },
    }));
    return {
      generatedAt: referenceTime,
      mode,
      metrics,
      actionQueue: rank(await filterAccessible(keepDemo(actionItems))),
      reviewQueue: rank(await filterAccessible(keepDemo(reviewItems))),
      riskQueue: rank(await filterAccessible(keepDemo(riskItems))),
      recommendationQueue: rank(await filterAccessible([...keepDemo(recItems), ...demoObjectItems])),
      notificationQueue: rank(keepDemo(notifItems)),
      incidentQueue: rank([]),
      recentActivity: auditItems,
    };
  }

  return {
    generatedAt: referenceTime,
    mode,
    metrics,
    actionQueue: rank(await filterAccessible(actionItems)),
    reviewQueue: rank(await filterAccessible(reviewItems)),
    riskQueue: rank(await filterAccessible([...riskItems.filter((i) => i.status !== "completed"), ...learningRiskItems])),
    recommendationQueue: rank(await filterAccessible([...recItems, ...learningRecItems])),
    notificationQueue: rank(notifItems),
    incidentQueue: rank([...incidentItems, ...learningIncidentItems]),
    recentActivity: auditItems,
  };
}
