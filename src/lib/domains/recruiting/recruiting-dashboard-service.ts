// Phase 4 RECRUITING — dashboard service. Tenant-scoped counts and operator
// cards built from the ontology + evidence fabric.

import { db } from "@/lib/lawrence-core/db";
import { listObjects, linksFor } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { DomainDashboard, DomainDashboardCard } from "@/lib/domains/domain-workflow-types";

export async function getRecruitingDashboard(ctx: ActorContext): Promise<DomainDashboard> {
  const jobs = await listObjects(ctx, "Job");
  const candidates = await listObjects(ctx, "Candidate");
  const submissions = await listObjects(ctx, "Submission");
  const recruiterNotes = await listObjects(ctx, "RecruiterNote");

  const counts: Record<string, number> = {
    jobs: jobs.length,
    candidates: candidates.length,
    submissions: submissions.length,
    recruiterNotes: recruiterNotes.length,
  };

  // Candidates needing review: those with an open recruiting fit review case.
  const reviewCases = await db.reviewCases.list(
    ctx.tenantId,
    (c) => c.caseType === "recruiting.candidate_fit_review" && c.status === "open",
  );
  const needingReview: DomainDashboardCard["items"] = candidates
    .filter((cand) => reviewCases.some((rc) => rc.subjectObjectId === cand.id))
    .map((cand) => ({
      objectId: cand.id,
      title: cand.title ?? cand.id,
      status: cand.status ?? null,
      nextAction: "needs_review",
    }));

  // Shortlist recommendations: Submissions in the shortlisted stage.
  const shortlisted = submissions.filter((s) => s.status === "shortlisted");
  const shortlistItems: DomainDashboardCard["items"] = shortlisted.map((s) => ({
    objectId: s.id,
    title: s.title ?? s.id,
    status: s.status ?? null,
    nextAction: "submit_to_hiring_manager",
  }));

  // Missing evidence: candidates with no indexed evidence chunks.
  const missingEvidenceItems: DomainDashboardCard["items"] = [];
  for (const cand of candidates) {
    const chunks = await db.evidenceChunks.list(ctx.tenantId, (c) => c.sourceObjectId === cand.id);
    if (chunks.length === 0) {
      // Cross-check ontology links for any attached evidence object.
      const links = await linksFor(ctx, cand.id);
      const hasEvidenceLink = links.some((l) => l.linkType === "evidence");
      if (!hasEvidenceLink) {
        missingEvidenceItems.push({
          objectId: cand.id,
          title: cand.title ?? cand.id,
          status: cand.status ?? null,
          nextAction: "collect_evidence",
        });
      }
    }
  }

  const cards: DomainDashboardCard[] = [
    {
      key: "candidates_needing_review",
      label: "Candidates Needing Review",
      count: needingReview.length,
      items: needingReview,
    },
    {
      key: "shortlist_recommendations",
      label: "Shortlist Recommendations",
      count: shortlistItems.length,
      items: shortlistItems,
    },
    {
      key: "missing_evidence",
      label: "Missing Evidence",
      count: missingEvidenceItems.length,
      items: missingEvidenceItems,
    },
  ];

  return { domain: "recruiting", counts, cards };
}
