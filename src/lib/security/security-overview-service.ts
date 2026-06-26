// Phase 10 — security posture overview. Read-only aggregate for the security
// admin dashboard: finding counts by severity, latest audit integrity status,
// classification coverage, retention activity, and export history.

import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";
import type { SecuritySeverity } from "./security-types";

export interface SecurityPosture {
  generatedAt: string;
  findings: {
    open: number;
    bySeverity: Record<SecuritySeverity, number>;
    criticalOpen: number;
  };
  auditIntegrity: { lastCheckPassed: boolean | null; checks: number };
  classifications: { total: number; byClassification: Record<string, number> };
  retention: { policies: number; jobs: number };
  complianceExports: { total: number; lastStatus: string | null };
}

export async function getSecurityPosture(ctx: ActorContext): Promise<SecurityPosture> {
  const t = ctx.tenantId;
  const [findings, checks, classifications, retentionPolicies, retentionJobs, exports] = await Promise.all([
    db.securityFindings.list(t),
    db.auditIntegrityChecks.list(t),
    db.dataClassifications.list(t),
    db.retentionPolicies.list(t),
    db.retentionJobs.list(t),
    db.complianceExports.list(t),
  ]);

  const bySeverity: Record<SecuritySeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let open = 0;
  for (const f of findings) {
    if (f.status === "open") {
      open += 1;
      bySeverity[f.severity] += 1;
    }
  }

  const byClassification: Record<string, number> = {};
  for (const c of classifications) byClassification[c.classification] = (byClassification[c.classification] ?? 0) + 1;

  const sortedChecks = [...checks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sortedExports = [...exports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    generatedAt: sortedChecks[0]?.createdAt ?? findings[0]?.createdAt ?? "1970-01-01T00:00:00.000Z",
    findings: { open, bySeverity, criticalOpen: bySeverity.critical },
    auditIntegrity: {
      lastCheckPassed: sortedChecks[0] ? sortedChecks[0].status === "passed" : null,
      checks: checks.length,
    },
    classifications: { total: classifications.length, byClassification },
    retention: { policies: retentionPolicies.length, jobs: retentionJobs.length },
    complianceExports: { total: exports.length, lastStatus: sortedExports[0]?.status ?? null },
  };
}
