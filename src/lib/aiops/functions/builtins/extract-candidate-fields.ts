// extract_candidate_fields — the candidate-extraction model step as a first-class
// LawrenceFunction. It is the SINGLE source of the prompt + schema used by the
// paste-a-profile flow, so the extraction eval suite measures exactly what the
// feature runs. Pure: it calls the model and returns fields; it persists nothing.

import { resolveModelProvider } from "@/lib/aiops/models/model-router";
import { runModelCompletion } from "../../execution/inference-pipeline";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

/** Flat schema matching a profile/CV's fields. */
export const CANDIDATE_FIELD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    fullName: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    headline: { type: "string" },
    currentTitle: { type: "string" },
    currentCompany: { type: "string" },
    profileUrl: { type: "string" },
    educationDegree: { type: "string" },
    educationInstitution: { type: "string" },
    summary: { type: "string" },
  },
};

/** The populatable fields used for the heuristic confidence score. */
export const CANDIDATE_STRING_FIELDS = [
  "fullName",
  "email",
  "phone",
  "location",
  "headline",
  "currentTitle",
  "currentCompany",
  "profileUrl",
  "educationDegree",
  "educationInstitution",
] as const;

export function buildCandidateExtractionPrompt(text: string): string {
  return (
    "Extract the candidate's contact and profile fields as JSON from the text " +
    "below. Use only information present in the text; leave a field empty if it " +
    `is not stated. Do not invent values.\n\n${text.slice(0, 6000)}`
  );
}

export interface ExtractedCandidateFields {
  fields: Record<string, unknown>;
  provider: string;
  modelKey: string;
}

/** Run the candidate extraction model step. Honors per-tenant "extraction"
 *  routing; falls back to the process-default provider (mock until a key set). */
export async function extractCandidateFields(
  ctx: ActorContext,
  text: string,
): Promise<ExtractedCandidateFields> {
  const provider = await resolveModelProvider(ctx, "extraction");
  const completion = await runModelCompletion({
    provider,
    request: {
      prompt: buildCandidateExtractionPrompt(text),
      outputSchema: CANDIDATE_FIELD_SCHEMA,
    },
    workloadType: "extraction",
  });
  return {
    fields: completion.json ?? {},
    provider: completion.provider,
    modelKey: completion.modelKey,
  };
}

export const extractCandidateFieldsFunction: LawrenceFunction<{ text?: string }, Record<string, unknown>> = {
  key: "extract_candidate_fields",
  name: "Extract candidate fields",
  description: "Extract a candidate's contact/profile fields from unstructured text.",
  klass: "extract",
  outputSchema: CANDIDATE_FIELD_SCHEMA,
  async run(ctx: ActorContext, input): Promise<FunctionExecutionResult<Record<string, unknown>>> {
    const { fields } = await extractCandidateFields(ctx, String(input.text ?? ""));
    return { output: fields };
  },
};
