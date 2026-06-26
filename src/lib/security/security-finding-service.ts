// Phase 10 — security findings store. Findings are auditable records of a
// security control gap (tenant leak, missing check, secret exposure, audit gap,
// etc.). Evidence is masked — never raw secret values.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import type {
  SecurityFinding,
  SecurityFindingType,
  SecuritySeverity,
} from "./security-types";

export interface CreateFindingInput {
  severity: SecuritySeverity;
  findingType: SecurityFindingType;
  title: string;
  summary?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  evidence?: Array<Record<string, unknown>>;
}

/** Create a finding for a tenant (system-internal; no caller permission needed). */
export async function createSecurityFinding(
  tenantId: string,
  input: CreateFindingInput,
): Promise<SecurityFinding> {
  const finding = await db.securityFindings.insert({
    id: id("secf"),
    tenantId,
    severity: input.severity,
    findingType: input.findingType,
    title: input.title,
    summary: input.summary ?? null,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    status: "open",
    evidence: input.evidence ?? [],
    createdAt: now(),
    resolvedAt: null,
  });
  await emitAudit(systemActor(tenantId), "security.finding.created", { type: "security_finding", id: finding.id }, {
    severity: input.severity,
    findingType: input.findingType,
  });
  return finding;
}

export async function listSecurityFindings(
  tenantId: string,
  filters: { status?: SecurityFinding["status"]; severity?: SecuritySeverity } = {},
): Promise<SecurityFinding[]> {
  return (
    await db.securityFindings.list(tenantId, (f) => {
      if (filters.status && f.status !== filters.status) return false;
      if (filters.severity && f.severity !== filters.severity) return false;
      return true;
    })
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveFinding(
  ctx: ActorContext,
  findingId: string,
  status: "resolved" | "accepted_risk" | "in_review" = "resolved",
): Promise<SecurityFinding> {
  requirePermission(ctx, "security.finding_resolve");
  const finding = await db.securityFindings.get(ctx.tenantId, findingId);
  if (!finding) throw new Error(`security finding not found: ${findingId}`);
  const updated = await db.securityFindings.update(finding.id, {
    status,
    resolvedAt: status === "resolved" || status === "accepted_risk" ? now() : null,
  });
  await emitAudit(ctx, "security.finding.resolved", { type: "security_finding", id: findingId }, { status });
  return updated;
}
