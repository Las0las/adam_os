// Phase 4 CLAIMS — dashboard service. Tenant-scoped counts and operator cards
// built from the ontology (ValidationCase / ValidationFinding) and the review
// queue. All reads are async and index-guarded.

import { db } from "@/lib/lawrence-core/db";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { DomainDashboard, DomainDashboardCard } from "@/lib/domains/domain-workflow-types";

function severityOf(obj: { status?: string | null; properties: Record<string, unknown> }): string | null {
  const fromProps = obj.properties.severity;
  if (typeof fromProps === "string") return fromProps;
  return obj.status ?? null;
}

export async function getClaimsDashboard(ctx: ActorContext): Promise<DomainDashboard> {
  const validationCases = await listObjects(ctx, "ValidationCase");
  const findings = await listObjects(ctx, "ValidationFinding");

  const openCases = validationCases.filter((c) => c.status === "open");
  const validatedCases = validationCases.filter((c) => c.status === "validated");
  const criticalFindings = findings.filter((f) => severityOf(f) === "critical");
  const missingEvidenceFindings = findings.filter(
    (f) => f.properties.findingType === "missing_evidence",
  );

  const awaitingReview = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "claims.case.needs_review" && c.status === "open",
  );

  const counts: Record<string, number> = {
    openCases: openCases.length,
    findings: findings.length,
    critical: criticalFindings.length,
    awaitingReview: awaitingReview.length,
    validated: validatedCases.length,
  };

  const openCaseItems: DomainDashboardCard["items"] = openCases.map((c) => ({
    objectId: c.id,
    title: c.title ?? c.id,
    status: c.status ?? null,
    nextAction: "run_validation",
  }));

  const criticalItems: DomainDashboardCard["items"] = criticalFindings.map((f) => ({
    objectId: f.id,
    title: f.title ?? f.id,
    severity: severityOf(f),
    status: f.status ?? null,
    nextAction: "review",
  }));

  const missingEvidenceItems: DomainDashboardCard["items"] = missingEvidenceFindings.map((f) => ({
    objectId: f.id,
    title: f.title ?? f.id,
    severity: severityOf(f),
    status: f.status ?? null,
    nextAction: "collect_evidence",
  }));

  const awaitingItems: DomainDashboardCard["items"] = awaitingReview.map((c) => ({
    objectId: c.subjectObjectId ?? c.id,
    title: c.summary ?? c.id,
    severity: c.severity ?? null,
    status: c.status ?? null,
    nextAction: "human_review",
  }));

  const validatedItems: DomainDashboardCard["items"] = validatedCases.map((c) => ({
    objectId: c.id,
    title: c.title ?? c.id,
    status: c.status ?? null,
    nextAction: "close",
  }));

  const cards: DomainDashboardCard[] = [
    { key: "open_validation_cases", label: "Open Validation Cases", count: openCaseItems.length, items: openCaseItems },
    { key: "critical_findings", label: "Critical Findings", count: criticalItems.length, items: criticalItems },
    { key: "missing_evidence", label: "Missing Evidence", count: missingEvidenceItems.length, items: missingEvidenceItems },
    { key: "awaiting_human_review", label: "Awaiting Human Review", count: awaitingItems.length, items: awaitingItems },
    { key: "recently_validated", label: "Recently Validated", count: validatedItems.length, items: validatedItems },
  ];

  return { domain: "claims", counts, cards };
}
