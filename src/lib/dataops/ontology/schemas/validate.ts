// Pure canonical-object validation (ONT-001 §C). validateCanonicalObject is total
// and never throws: any internal failure is reported as a single
// "validator_error" violation so a warn-only caller can never be turned into a
// failure (Constitution Article IV — observation SHALL NOT change execution).
// Returns [] for an undefined schema (unregistered objectType).

import type { CanonicalObjectSchema, CanonicalObjectInput, Violation } from "./types";

export function validateCanonicalObject(
  schema: CanonicalObjectSchema | undefined,
  input: CanonicalObjectInput,
): Violation[] {
  if (!schema) return [];
  const violations: Violation[] = [];
  try {
    // status — SHALL be present and within the lifecycle domain.
    if (input.status == null) {
      violations.push({
        path: "status",
        code: "missing_status",
        message: `${schema.objectType} status is required`,
      });
    } else {
      const r = schema.status.safeParse(input.status);
      if (!r.success) {
        violations.push({
          path: "status",
          code: "invalid_status",
          message: `status "${String(input.status)}" is not in the ${schema.objectType} lifecycle domain`,
        });
      }
    }

    // title — required for some objects (ONT-001 §Public Interfaces).
    if (schema.requireTitle && (input.title == null || input.title === "")) {
      violations.push({
        path: "title",
        code: "required",
        message: `${schema.objectType} title is required`,
      });
    }

    // properties — required fields and declared types (extra props pass through).
    const r = schema.properties.safeParse(input.properties ?? {});
    if (!r.success) {
      for (const issue of r.error.issues) {
        const path = issue.path.length ? `properties.${issue.path.join(".")}` : "properties";
        violations.push({
          path,
          code: issue.code === "custom" ? "required" : issue.code,
          message: issue.message,
        });
      }
    }
  } catch (err) {
    // Total: a validator failure SHALL NOT propagate. Report it as a soft signal.
    violations.push({
      path: "",
      code: "validator_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return violations;
}
