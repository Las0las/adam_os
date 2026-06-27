// Phase 4 RECRUITING — action handlers. A recruiter-note writeback (exempt) and
// a customer-affecting shortlist action that requires approval. Self-registers.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";
import { emitEvent } from "@/lib/mission-control/notifications/notification-service";
import { id } from "@/lib/lawrence-core/utils/ids";
import type { ActorContext } from "@/types/platform";

// recruiting.create_recruiter_note — internal writeback, no approval gate.
registerAction({
  key: "recruiting.create_recruiter_note",
  requiresApproval: false,
  precondition(_ctx: ActorContext, input: Record<string, unknown>): string | null {
    return input.note ? null : "missing note";
  },
  async run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const candidateId = input.candidateId == null ? null : String(input.candidateId);
    const jobId = input.jobId == null ? null : String(input.jobId);
    const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [];

    const note = await upsertObject(ctx, {
      objectType: "RecruiterNote",
      externalKey: `note-${id("n")}`,
      title: "Recruiter note",
      properties: {
        body: String(input.note),
        candidateId,
        jobId,
        evidenceRefs,
      },
    });

    if (candidateId) {
      await linkObjects(ctx, {
        linkType: "about",
        from: { objectType: "RecruiterNote", objectId: note.id },
        to: { objectType: "Candidate", objectId: candidateId },
      });
    }
    if (jobId) {
      await linkObjects(ctx, {
        linkType: "for",
        from: { objectType: "RecruiterNote", objectId: note.id },
        to: { objectType: "Job", objectId: jobId },
      });
    }

    return { noteId: note.id };
  },
});

// recruiting.shortlist_candidate — affects a person -> requires approval.
registerAction({
  key: "recruiting.shortlist_candidate",
  requiredPermission: "review.reviewer",
  requiresApproval: true,
  precondition(_ctx: ActorContext, input: Record<string, unknown>): string | null {
    return Number.isNaN(Number(input.score)) ? "invalid score" : null;
  },
  async run(ctx: ActorContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const candidateId = String(input.candidateId);
    const jobId = String(input.jobId);
    const score = Number(input.score);
    const rationale = input.rationale == null ? null : String(input.rationale);

    const submission = await upsertObject(ctx, {
      objectType: "Submission",
      externalKey: `sub-${candidateId}-${jobId}`,
      title: "Shortlist submission",
      // ONT-001 Submission: status SHALL be a CandidateStage. Shortlisting puts a
      // candidate forward to a job → "submitted". The shortlist sub-state is
      // retained via the `shortlisted` marker below (read by the dashboard).
      status: "submitted",
      properties: {
        // Canonical ONT-001 keys.
        jobKey: jobId,
        candidateKey: candidateId,
        stage: "submitted",
        score,
        rationale,
        // Marks this submission as shortlist-originated (preserves the
        // "Shortlist recommendations" dashboard set after the status alignment).
        shortlisted: true,
        // Legacy aliases retained for backward compatibility (documented shim,
        // not a new contract). Do not rely on these for new code.
        candidateId,
        jobId,
      },
    });

    // Also drop a recruiter note recording the shortlist rationale.
    await upsertObject(ctx, {
      objectType: "RecruiterNote",
      externalKey: `note-${id("n")}`,
      title: "Recruiter note",
      properties: {
        body: rationale ?? "Shortlisted candidate.",
        candidateId,
        jobId,
        evidenceRefs: [],
      },
    });

    const recipient = input.recipientUserId == null ? "system" : String(input.recipientUserId);
    await emitEvent(ctx, "recruiting.shortlist.created", recipient, {
      summary: `Candidate ${candidateId} shortlisted for ${jobId}`,
      subjectId: candidateId,
    });

    return { submissionId: submission.id, stage: "submitted", shortlisted: true };
  },
});
