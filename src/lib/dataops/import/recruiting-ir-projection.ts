// IR -> Ontology projection. Turns one canonical application record
// (job + candidate + submission) into the ontology sub-graph:
//
//     Candidate ──submitted──► Submission ──targets──► Job
//
// The Submission is a first-class lifecycle object (not a mere edge), so it can
// later accumulate interview history, scores, offers, communications, etc.
// Upserts are idempotent on (objectType, externalKey): re-importing the same
// workbook merges rather than duplicates. Provenance is stamped onto every
// object, and every upsert/link also emits an immutable audit event.

import { upsertObject, linkObjects } from "@/lib/dataops/ontology/object-service";
import type { ActorContext } from "@/types/platform";
import type { OntologyObject } from "@/types/dataops";
import type { RecruitingSubmissionRecord } from "./recruiting-ir";

export async function projectSubmissionRecord(
  ctx: ActorContext,
  rec: RecruitingSubmissionRecord,
): Promise<OntologyObject[]> {
  const { job, candidate, submission } = rec;

  const jobObj = await upsertObject(ctx, {
    objectType: "Job",
    externalKey: job.externalKey,
    title: job.title ?? job.externalKey,
    status: "open",
    properties: {
      source: job.source,
      title: job.title,
      url: job.url,
      externalIds: job.externalIds,
      atsJobId: job.externalIds.find((e) => e.system === "ats")?.id ?? null,
      location: job.location,
      compensation: job.compensation,
      hiringProject: job.hiringProject,
      contract: job.contract,
      provenance: job.provenance,
    },
  });

  const candidateObj = await upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: candidate.externalKey,
    title: candidate.fullName ?? candidate.email ?? candidate.externalKey,
    status: "new",
    properties: {
      source: candidate.source,
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      headline: candidate.headline,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      profileUrl: candidate.profileUrl,
      education: candidate.education,
      provenance: candidate.provenance,
    },
  });

  const submissionObj = await upsertObject(ctx, {
    objectType: "Submission",
    externalKey: submission.externalKey,
    title: `${candidate.fullName ?? candidate.externalKey} → ${job.title ?? job.externalKey}`,
    status: submission.stage,
    properties: {
      source: submission.source,
      jobKey: submission.jobKey,
      candidateKey: submission.candidateKey,
      appliedAt: submission.appliedAt,
      stage: submission.stage,
      rawStage: submission.rawStage,
      screeningAnswers: submission.screeningAnswers,
      provenance: submission.provenance,
    },
  });

  // Graph edges: Candidate ──submitted──► Submission ──targets──► Job.
  await linkObjects(ctx, {
    linkType: "submitted",
    from: { objectType: candidateObj.objectType, objectId: candidateObj.id },
    to: { objectType: submissionObj.objectType, objectId: submissionObj.id },
  });
  await linkObjects(ctx, {
    linkType: "targets",
    from: { objectType: submissionObj.objectType, objectId: submissionObj.id },
    to: { objectType: jobObj.objectType, objectId: jobObj.id },
  });

  return [jobObj, candidateObj, submissionObj];
}
