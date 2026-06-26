// Function registry (§26). Holds the built-in LawrenceFunctions; domain packs
// register additional functions here.

import type { LawrenceFunction } from "./function-types";
import { answerWithCitations } from "./builtins/answer-with-citations";
import { summarizeObject } from "./builtins/summarize-object";
import { classifyDocument } from "./builtins/classify-document";
import { extractStructuredFields } from "./builtins/extract-structured-fields";
import { extractCandidateFieldsFunction } from "./builtins/extract-candidate-fields";
import { extractJobFieldsFunction } from "./builtins/extract-job-fields";
import { generateDraftResponse } from "./builtins/generate-draft-response";
import { recommendNextAction } from "./builtins/recommend-next-action";

const registry = new Map<string, LawrenceFunction<any, any>>();

export function registerFunction(fn: LawrenceFunction<any, any>): void {
  registry.set(fn.key, fn);
}

export function resolveFunction(key: string): LawrenceFunction<any, any> | undefined {
  return registry.get(key);
}

export function listFunctions(): LawrenceFunction<any, any>[] {
  return [...registry.values()];
}

for (const fn of [
  answerWithCitations,
  summarizeObject,
  classifyDocument,
  extractStructuredFields,
  extractCandidateFieldsFunction,
  extractJobFieldsFunction,
  generateDraftResponse,
  recommendNextAction,
]) {
  registerFunction(fn);
}
