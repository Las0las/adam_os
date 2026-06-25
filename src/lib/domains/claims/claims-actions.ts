// Phase 4 CLAIMS — action handler. Persists a finding as a ValidationFinding
// ontology object (there is no validationFindings collection), links it to its
// ValidationCase, and — for high/critical severities — opens a human review
// case and notifies the validator. Internal writeback: no approval gate.
// Self-registers on import.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";
import { openReviewCase } from "@/lib/mission-control/review-queue/review-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";

type Severity = "low" | "medium" | "high" | "critical";

function asSeverity(value: unknown): Severity {
  return value === "low" || value === "medium" || value === "high" || value === "critical"
    ? value
    : "medium";
}

registerAction({
  key: "claims.create_validation_finding",
  requiresApproval: false,
  precondition(_ctx: ActorContext, input: Record<string, unknown>): string | null {
    if (!input.validationCaseId) return "missing validationCaseId";
    if (!input.findingType) return "missing findingType";
    return null;
  },
  async run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const validationCaseId = String(input.validationCaseId);
    const severity = asSeverity(input.severity);
    const findingType = String(input.findingType);
    const message = input.message == null ? "" : String(input.message);
    const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [];

    const finding = await upsertObject(ctx, {
      objectType: "ValidationFinding",
      externalKey: `finding-${id("f")}`,
      title: findingType,
      status: severity,
      properties: {
        validationCaseId,
        severity,
        findingType,
        message,
        evidenceRefs,
      },
    });

    await linkObjects(ctx, {
      linkType: "finding_of",
      from: { objectType: "ValidationFinding", objectId: finding.id },
      to: { objectType: "ValidationCase", objectId: validationCaseId },
    });

    let reviewCaseId: string | undefined;
    if (severity === "high" || severity === "critical") {
      const rc = await openReviewCase(ctx, {
        caseType: "claims.case.needs_review",
        subject: { type: "ValidationCase", id: validationCaseId },
        severity,
        summary: message || `Validation finding (${findingType}) requires review`,
      });
      reviewCaseId = rc.id;

      await emitEvent(ctx, "claims.finding.critical", "system", {
        summary: message || `Critical validation finding (${findingType})`,
        subjectId: validationCaseId,
      });
    }

    return reviewCaseId ? { findingId: finding.id, reviewCaseId } : { findingId: finding.id };
  },
});
