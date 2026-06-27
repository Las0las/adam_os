// Canonical object schema types (ONT-001). A CanonicalObjectSchema fixes, for one
// objectType, the legal `status` domain (ONT-001 §Lifecycle) and the property
// shape (ONT-001 §Public Interfaces). Validation is warn-only in this phase: a
// violation is reported and surfaced, never enforced (see validate.ts and the
// upsertObject integration). Promotion to reject-mode is gated behind an ADR that
// moves ONT-001 to Active (see architecture/design/canonical-schema-registry.md).

import type { z } from "zod";

/** A single, structural deviation from a canonical object's contract. */
export interface Violation {
  /** Dotted path of the offending field, e.g. "status", "title",
   *  "properties.email". Empty string for a whole-object failure. */
  path: string;
  /** Stable machine code, e.g. "missing_status" | "invalid_status" |
   *  "required" | "invalid_type" | "validator_error". */
  code: string;
  /** Human-readable description. */
  message: string;
}

/** The canonical contract for one objectType (ONT-001). */
export interface CanonicalObjectSchema {
  /** The canonical objectType this schema governs, e.g. "Candidate". */
  objectType: string;
  /** Whether the object's top-level `title` SHALL be present (ONT-001
   *  §Public Interfaces — e.g. Job and Account require a title). */
  requireTitle: boolean;
  /** Legal `status` domain (ONT-001 §Lifecycle). A z.enum of the allowed values. */
  status: z.ZodTypeAny;
  /** Property-bag shape. SHALL be built with `.passthrough()` so undeclared
   *  properties never produce a violation (only declared invariants are checked). */
  properties: z.ZodTypeAny;
}

/** The canonical-object-shaped value validateCanonicalObject inspects. This is the
 *  effective (post-merge) object about to be persisted, not the raw upsert input. */
export interface CanonicalObjectInput {
  objectType: string;
  externalKey?: string | null;
  title?: string | null;
  status?: string | null;
  properties?: Record<string, unknown>;
}
