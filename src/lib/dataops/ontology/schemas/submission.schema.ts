// Submission canonical schema (ONT-001). A Submission is a first-class lifecycle
// object. Required properties: jobKey, candidateKey, stage. Status domain SHALL be
// the CandidateStage pipeline lifecycle (src/types/domain.ts). Extra properties
// pass through.

import { z } from "zod";
import type { CandidateStage } from "@/types/domain";
import type { CanonicalObjectSchema } from "./types";

/** The canonical pipeline lifecycle. Kept in lockstep with the CandidateStage
 *  type via the compile-time assertion below: if the type changes, this fails to
 *  typecheck until the tuple is updated (ONT-001 §Lifecycle parity). */
export const CANDIDATE_STAGES = [
  "new",
  "screen",
  "submitted",
  "interview",
  "offer",
  "placed",
  "rejected",
] as const;

// Compile-time parity: the tuple and the CandidateStage type SHALL be identical.
type _StageTupleMember = (typeof CANDIDATE_STAGES)[number];
type _AssertTupleCoversType = CandidateStage extends _StageTupleMember ? true : never;
type _AssertTypeCoversTuple = _StageTupleMember extends CandidateStage ? true : never;
const _stageParity: [_AssertTupleCoversType, _AssertTypeCoversTuple] = [true, true];
void _stageParity;

const properties = z
  .object({
    jobKey: z.string().min(1),
    candidateKey: z.string().min(1),
    stage: z.enum(CANDIDATE_STAGES),
  })
  .passthrough();

export const submissionSchema: CanonicalObjectSchema = {
  objectType: "Submission",
  requireTitle: false, // title = "<candidate> → <job>" (derived)
  status: z.enum(CANDIDATE_STAGES),
  properties,
};
