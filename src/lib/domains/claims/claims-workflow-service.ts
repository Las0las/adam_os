// Phase 4 CLAIMS — claim-validation workflow orchestrator. Runs the evidence
// summary function, persists EVERY finding through the action engine (which also
// opens review cases and notifies for high/critical findings), reads back the
// resulting review cases, and — when the disposition is "validated" — marks the
// ValidationCase validated. Does not rely on the generic agent condition runner.

import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { upsertObject, listObjects } from "@/lib/dataops/ontology/object-service";
import { db } from "@/lib/lawrence-core/db";
import type { ActorContext } from "@/types/platform";
import type { DomainWorkflowResult } from "@/lib/domains/domain-workflow-types";
import type { EvidenceSummaryOutput } from "./claims-functions";

interface RunClaimValidationInput {
  validationCaseId: string;
  recipientUserId?: string;
}

export async function runClaimValidationWorkflow(
  ctx: ActorContext,
  input: RunClaimValidationInput,
): Promise<DomainWorkflowResult> {
  const { validationCaseId } = input;
  const recipient = input.recipientUserId ?? "system";

  const fnRun = await runFunction(ctx, "claims.validation_case_evidence_summary", {
    validationCaseId,
  });
  const out = (fnRun.output ?? {}) as EvidenceSummaryOutput;
  const findings = Array.isArray(out.findings) ? out.findings : [];

  const reviewCaseIds: string[] = [];
  const notificationIds: string[] = [];
  const actionExecutionIds: string[] = [];

  // Persist EVERY finding through the action engine.
  for (const finding of findings) {
    const exec = await executeAction(ctx, {
      actionKey: "claims.create_validation_finding",
      input: {
        validationCaseId,
        severity: finding.severity,
        findingType: finding.findingType,
        message: finding.message,
        evidenceRefs: finding.evidenceRefs,
      },
      object: { type: "ValidationCase", id: validationCaseId },
      approvalExempt: true,
    });
    actionExecutionIds.push(exec.id);

    const result = (exec.result ?? {}) as { reviewCaseId?: unknown };
    if (typeof result.reviewCaseId === "string") reviewCaseIds.push(result.reviewCaseId);
  }

  // Read back review cases opened for this case so the result reflects all of
  // them (deduped) regardless of which action created them.
  const reviewCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "claims.case.needs_review" && c.subjectObjectId === validationCaseId,
  );
  for (const rc of reviewCases) {
    if (!reviewCaseIds.includes(rc.id)) reviewCaseIds.push(rc.id);
  }

  // Notify the validator whenever any finding is critical/high.
  const hasEscalation = findings.some(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  if (hasEscalation) {
    const notes = await emitEvent(ctx, "claims.finding.critical", recipient, {
      summary: `Validation case ${validationCaseId} has high-severity findings`,
      subjectId: validationCaseId,
    });
    for (const n of notes) notificationIds.push(n.id);
  }

  // Disposition "validated" -> mark the ValidationCase validated.
  if (out.recommendedDisposition === "validated") {
    const cases = await listObjects(ctx, "ValidationCase");
    const found = cases.find((c) => c.id === validationCaseId);
    if (found) {
      await upsertObject(ctx, {
        objectType: "ValidationCase",
        externalKey: found.externalKey,
        title: found.title,
        status: "validated",
        properties: {},
      });
    }
  }

  return {
    domain: "claims",
    functionRunId: fnRun.id,
    output: out as unknown as Record<string, unknown>,
    reviewCaseIds,
    notificationIds,
    actionExecutionIds,
  };
}
