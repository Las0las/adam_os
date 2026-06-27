// Security Middleware Platform (Milestone 6.0, deliverable #3) — Response
// Validator.
//
// Validates a provider response before it returns to the application: UTF-8
// validity, maximum payload size, required JSON / required fields, a minimal
// JSON-schema check, and caller-supplied business invariants. A validation
// failure throws a normalized ResponseValidationError (kind "validation_failed")
// so the pipeline turns it into a normalized failure result. Success and failure
// both publish a canonical security event.
//
// Attaches as execution middleware via `interceptResponse`. It inspects only —
// it never mutates the response. The default policy enforces only permissive
// invariants (valid UTF-8, a large size cap) that every legitimate response
// already satisfies, so enabling it changes no existing behavior.

import type { CompletionResponse } from "@/lib/aiops/models/model-provider";
import type { InferenceExecutionContext } from "@/lib/aiops/execution/execution-types";
import { ResponseValidationError } from "@/lib/aiops/execution/execution-errors";
import { guard, type ExecutionMiddleware } from "@/lib/aiops/execution/observability/execution-middleware";
import type { ExecutionEventBus } from "@/lib/aiops/execution/observability/execution-event-bus";
import { validationSucceeded, validationFailed } from "./security-events";
import { SECURITY_PRIORITY, type ValidationPolicy, type SecurityPolicyStore } from "./security-types";

/** True if `text` contains no unpaired UTF-16 surrogate (i.e. it encodes to
 *  valid UTF-8). */
function isValidUtf8(text: string): boolean {
  // Lone high surrogate not followed by a low surrogate, or a lone low surrogate.
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Minimal JSON-schema-ish check: presence of `required` keys and a typeof
 *  check for declared `properties`. Returns human-readable error labels. */
function checkSchema(json: Record<string, unknown>, schema: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const key of required) {
    if (!(key in json)) errors.push(`schema.missing:${key}`);
  }
  const props = (schema.properties as Record<string, { type?: string }> | undefined) ?? {};
  for (const [key, def] of Object.entries(props)) {
    if (!(key in json) || def.type == null) continue;
    const value = json[key];
    const ok =
      def.type === "array"
        ? Array.isArray(value)
        : def.type === "object"
          ? value !== null && typeof value === "object" && !Array.isArray(value)
          : typeof value === def.type;
    if (!ok) errors.push(`schema.type:${key}`);
  }
  return errors;
}

/** Run the full validation policy against a response. Pure — returns error
 *  labels (empty = valid). */
export function validateResponse(response: CompletionResponse, policy: ValidationPolicy): string[] {
  const errors: string[] = [];
  const text = response.text ?? "";

  if (policy.utf8 && !isValidUtf8(text)) errors.push("utf8.invalid");

  const jsonBytes = response.json ? byteLength(JSON.stringify(response.json)) : 0;
  if (byteLength(text) + jsonBytes > policy.maxPayloadBytes) errors.push("payload.too_large");

  if (policy.requireJson && response.json == null) errors.push("json.required");

  if (policy.requiredFields.length > 0) {
    const json = response.json;
    if (json == null) {
      errors.push("json.required");
    } else {
      for (const field of policy.requiredFields) {
        if (!(field in json)) errors.push(`field.missing:${field}`);
      }
    }
  }

  if (policy.schema && response.json) {
    errors.push(...checkSchema(response.json, policy.schema));
  }

  for (const invariant of policy.invariants) {
    let ok = false;
    try {
      ok = invariant.check(response);
    } catch {
      ok = false;
    }
    if (!ok) errors.push(`invariant:${invariant.name}`);
  }

  return errors;
}

export class ResponseValidator implements ExecutionMiddleware {
  readonly name = "response-validator";
  readonly priority = SECURITY_PRIORITY.validator;

  constructor(
    private readonly bus: ExecutionEventBus,
    private readonly store: SecurityPolicyStore,
  ) {}

  interceptResponse(response: CompletionResponse, ctx: InferenceExecutionContext): void {
    const policy = this.store.current();
    if (!policy.enabled.validator || policy.validation.mode === "off") return;

    const errors = validateResponse(response, policy.validation);
    if (errors.length > 0) {
      guard(() => this.bus.publish(validationFailed(ctx, errors)));
      throw new ResponseValidationError(`response validation failed: ${errors.join(", ")}`);
    }
    guard(() => this.bus.publish(validationSucceeded(ctx)));
  }
}
