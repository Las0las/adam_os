// Phase 10 — compliance exports. Produces tenant-scoped, checksum-sealed export
// bundles for auditors: audit log, access map, data map, AI usage, retention
// history, security findings, and (gated) full evidence. Sensitive payloads are
// redacted before they leave the system; full_evidence requires its own grant.

import { createHash } from "node:crypto";
import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { redactForPrompt } from "./redaction-service";
import type { ActorContext } from "@/types/platform";
import type { ComplianceExport, ComplianceExportType } from "./compliance-types";

function checksum(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function buildBundle(
  ctx: ActorContext,
  exportType: ComplianceExportType,
  parameters: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const t = ctx.tenantId;
  switch (exportType) {
    case "audit": {
      const events = await db.auditEvents.list(t);
      return {
        exportType,
        eventCount: events.length,
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          subjectType: e.subjectType,
          subjectId: e.subjectId,
          actorUserId: e.actorUserId,
          createdAt: e.createdAt,
          eventHash: e.eventHash ?? null,
          previousHash: e.previousHash ?? null,
        })),
      };
    }
    case "access": {
      const acls = await db.objectAclEntries.list(t);
      const policies = await db.objectAccessPolicies.list(t);
      const groups = await db.groups.list(t);
      return { exportType, acls, policies, groups };
    }
    case "data_map": {
      const classifications = await db.dataClassifications.list(t);
      const byClass: Record<string, number> = {};
      for (const c of classifications) byClass[c.classification] = (byClass[c.classification] ?? 0) + 1;
      return { exportType, classificationCounts: byClass, records: classifications };
    }
    case "ai_usage": {
      const fnRuns = await db.functionRuns.list(t);
      const agentRuns = await db.agentRuns.list(t);
      return {
        exportType,
        functionRuns: fnRuns.map((r) => ({ id: r.id, functionId: r.functionId, status: r.status, createdAt: r.createdAt })),
        agentRuns: agentRuns.map((r) => ({ id: r.id, agentId: r.agentId, status: r.status, createdAt: r.createdAt })),
      };
    }
    case "retention": {
      const policies = await db.retentionPolicies.list(t);
      const jobs = await db.retentionJobs.list(t);
      return { exportType, policies, jobs };
    }
    case "security": {
      const findings = await db.securityFindings.list(t);
      const checks = await db.auditIntegrityChecks.list(t);
      return { exportType, findings, integrityChecks: checks };
    }
    case "full_evidence": {
      // Highest-sensitivity export — redact every excerpt before it leaves.
      const chunks = await db.evidenceChunks.list(t);
      return {
        exportType,
        chunkCount: chunks.length,
        chunks: chunks.map((c) => ({
          id: c.id,
          sourceObjectType: c.sourceObjectType,
          sourceObjectId: c.sourceObjectId,
          excerpt: redactForPrompt(c.text.slice(0, 280)).text,
        })),
      };
    }
    default:
      return { exportType, note: "unsupported export type" };
  }
}

export async function createComplianceExport(
  ctx: ActorContext,
  exportType: ComplianceExportType,
  parameters: Record<string, unknown> = {},
): Promise<ComplianceExport> {
  // full_evidence needs its own grant; everything else needs compliance_export.
  requirePermission(ctx, exportType === "full_evidence" ? "security.full_evidence_export" : "security.compliance_export");

  const record = await db.complianceExports.insert({
    id: id("cexp"),
    tenantId: ctx.tenantId,
    exportType,
    status: "running",
    requestedBy: ctx.actorUserId ?? null,
    parameters,
    storagePath: null,
    checksumSha256: null,
    createdAt: now(),
    completedAt: null,
    errorMessage: null,
  });

  try {
    const bundle = await buildBundle(ctx, exportType, parameters);
    const sum = checksum(bundle);
    const storagePath = `exports/${ctx.tenantId}/${record.id}.json`;
    const completed = await db.complianceExports.update(record.id, {
      status: "completed",
      storagePath,
      checksumSha256: sum,
      completedAt: now(),
    });
    await emitAudit(ctx, "security.compliance.export_completed", { type: "compliance_export", id: record.id }, {
      exportType,
      checksumSha256: sum,
      storagePath,
    });
    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await db.complianceExports.update(record.id, {
      status: "failed",
      errorMessage: message,
      completedAt: now(),
    });
    await emitAudit(ctx, "security.compliance.export_failed", { type: "compliance_export", id: record.id }, {
      exportType,
      error: message,
    });
    return failed;
  }
}

/** Recompute and return a completed export's bundle (for download), re-gated. */
export async function getComplianceExportBundle(
  ctx: ActorContext,
  exportId: string,
): Promise<{ export: ComplianceExport; bundle: Record<string, unknown> } | null> {
  const record = await db.complianceExports.get(ctx.tenantId, exportId);
  if (!record) return null;
  requirePermission(ctx, record.exportType === "full_evidence" ? "security.full_evidence_export" : "security.compliance_export");
  const bundle = await buildBundle(ctx, record.exportType, record.parameters);
  return { export: record, bundle };
}

export async function listComplianceExports(tenantId: string): Promise<ComplianceExport[]> {
  return (await db.complianceExports.list(tenantId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
