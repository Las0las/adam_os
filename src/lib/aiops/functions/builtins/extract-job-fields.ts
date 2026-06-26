// extract_job_fields — the job-description extraction model step as a first-class
// LawrenceFunction (single source of the prompt + schema), mirroring
// extract_candidate_fields. Pure: it calls the model and returns fields.

import { resolveModelProvider } from "@/lib/aiops/models/model-router";
import type { LawrenceFunction, FunctionExecutionResult } from "../function-types";
import type { ActorContext } from "@/types/platform";

/** Flat schema matching a job posting / JD's fields. */
export const JOB_FIELD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    employmentType: { type: "string" },
    seniority: { type: "string" },
    minSalary: { type: "string" },
    maxSalary: { type: "string" },
    currency: { type: "string" },
    compensationPeriod: { type: "string" },
    summary: { type: "string" },
    requirements: { type: "string" },
  },
};

export const JOB_STRING_FIELDS = [
  "title",
  "company",
  "location",
  "employmentType",
  "seniority",
  "minSalary",
  "maxSalary",
  "currency",
  "compensationPeriod",
  "summary",
  "requirements",
] as const;

export function buildJobExtractionPrompt(text: string): string {
  return (
    "Extract the job posting's fields as JSON from the description below. Use only " +
    "information present in the text; leave a field empty if it is not stated. Do " +
    `not invent values.\n\n${text.slice(0, 6000)}`
  );
}

export interface ExtractedJobFields {
  fields: Record<string, unknown>;
  provider: string;
  modelKey: string;
}

export async function extractJobFields(ctx: ActorContext, text: string): Promise<ExtractedJobFields> {
  const provider = await resolveModelProvider(ctx, "extraction");
  const completion = await provider.complete({
    prompt: buildJobExtractionPrompt(text),
    outputSchema: JOB_FIELD_SCHEMA,
  });
  return {
    fields: completion.json ?? {},
    provider: completion.provider,
    modelKey: completion.modelKey,
  };
}

export const extractJobFieldsFunction: LawrenceFunction<{ text?: string }, Record<string, unknown>> = {
  key: "extract_job_fields",
  name: "Extract job fields",
  description: "Extract a job posting's fields from an unstructured job description.",
  klass: "extract",
  outputSchema: JOB_FIELD_SCHEMA,
  async run(ctx: ActorContext, input): Promise<FunctionExecutionResult<Record<string, unknown>>> {
    const { fields } = await extractJobFields(ctx, String(input.text ?? ""));
    return { output: fields };
  },
};
