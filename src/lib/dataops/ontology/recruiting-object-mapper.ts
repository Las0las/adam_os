// Recruiting object mapper (§49). Projects normalized recruiting records into
// ontology objects. Two record shapes are handled:
//   - `recruiting_submission` (canonical IR from an import adapter): projects the
//     full Candidate ──submitted──► Submission ──targets──► Job sub-graph.
//   - generic candidate-list rows (csv/xlsx): projects a single Candidate keyed
//     on email (unchanged legacy behavior).

import type { ObjectMapper } from "./object-mapper-registry";
import { upsertObject } from "./object-service";
import { projectSubmissionRecord } from "@/lib/dataops/import/recruiting-ir-projection";
import {
  RECRUITING_SUBMISSION_RECORD_TYPE,
  type RecruitingSubmissionRecord,
} from "@/lib/dataops/import/recruiting-ir";
import type { ActorContext } from "@/types/platform";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";

function str(value: unknown): string | null {
  return value == null ? null : String(value);
}

export const recruitingObjectMapper: ObjectMapper = {
  key: "recruiting",
  async map(ctx: ActorContext, record: CanonicalRecord): Promise<OntologyObject[]> {
    if (record.recordType === RECRUITING_SUBMISSION_RECORD_TYPE) {
      return await projectSubmissionRecord(
        ctx,
        record.payload as unknown as RecruitingSubmissionRecord,
      );
    }

    const p = record.payload;
    const fullName = str(p.full_name ?? p.name ?? p.fullName);
    const email = str(p.email);
    if (!fullName && !email) return [];

    const candidate = await upsertObject(ctx, {
      objectType: "Candidate",
      externalKey: email ?? fullName,
      title: fullName ?? email,
      status: "new",
      properties: {
        fullName,
        email,
        phone: str(p.phone),
        location: str(p.location),
        summary: str(p.summary),
      },
    });
    return [candidate];
  },
};
