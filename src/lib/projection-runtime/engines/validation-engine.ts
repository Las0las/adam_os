// ValidationEngine — declarative, pure validation of a values map against a
// render plan's field + object rules. Pure and dependency-free so it runs
// identically on the client (pre-submit UX) and the server (defense-in-depth in
// the action handler). Business rules live in metadata, never in components.

import type { FieldValidationRule } from "../contracts/field";
import type { ObjectValidationRule } from "../contracts/enterprise-object";
import type { RenderPlan, ResolvedField } from "../contracts/universal-projection";

/** A single validation violation, keyed by field (or "" for object-level). */
export interface ValidationViolation {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: ValidationViolation[];
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkRule(field: string, value: unknown, rule: FieldValidationRule): ValidationViolation | null {
  switch (rule.kind) {
    case "required":
      return isEmpty(value) ? { field, code: "required", message: rule.message } : null;
    case "minLength": {
      if (isEmpty(value)) return null; // required handles emptiness
      const min = Number(rule.value ?? 0);
      return String(value).trim().length < min ? { field, code: "minLength", message: rule.message } : null;
    }
    case "maxLength": {
      if (isEmpty(value)) return null;
      const max = Number(rule.value ?? Infinity);
      return String(value).length > max ? { field, code: "maxLength", message: rule.message } : null;
    }
    case "pattern": {
      if (isEmpty(value)) return null;
      try {
        const re = new RegExp(String(rule.value ?? ""));
        return re.test(String(value)) ? null : { field, code: "pattern", message: rule.message };
      } catch {
        return null; // a malformed pattern never blocks (fail-open on infra error)
      }
    }
    case "email": {
      if (isEmpty(value)) return null;
      return EMAIL_RE.test(String(value)) ? null : { field, code: "email", message: rule.message };
    }
    default:
      return null;
  }
}

function checkObjectRule(
  rule: ObjectValidationRule,
  values: Record<string, unknown>,
): ValidationViolation | null {
  if (rule.kind === "anyOf") {
    const anyPresent = rule.fields.some((f) => !isEmpty(values[f]));
    return anyPresent ? null : { field: rule.fields[0] ?? "", code: "anyOf", message: rule.message };
  }
  return null;
}

/** Validate a values map against the field- and object-level rules of a plan. */
export function validateValues(
  fields: ResolvedField[],
  objectValidations: ObjectValidationRule[],
  values: Record<string, unknown>,
): ValidationResult {
  const violations: ValidationViolation[] = [];
  for (const field of fields) {
    if (!field.editable) continue;
    const value = values[field.key];
    for (const rule of field.validations) {
      const v = checkRule(field.key, value, rule);
      if (v) violations.push(v);
    }
  }
  for (const rule of objectValidations) {
    const v = checkObjectRule(rule, values);
    if (v) violations.push(v);
  }
  return { ok: violations.length === 0, violations };
}

/** Convenience: validate a full render plan (flattens its sections' fields). */
export function validatePlan(plan: RenderPlan, values: Record<string, unknown>): ValidationResult {
  const fields = plan.sections.flatMap((s) => s.fields);
  return validateValues(fields, plan.objectValidations, values);
}
