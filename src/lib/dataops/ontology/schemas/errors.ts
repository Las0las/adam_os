// Typed error for ONT-001 enforce-mode rejections. Thrown by upsertObject only
// when enforcement is explicitly enabled for the tenant (default is warn-only).
import type { Violation } from "./types";

export class OntologySchemaError extends Error {
  readonly objectType: string;
  readonly externalKey: string | null;
  readonly violations: Violation[];

  constructor(objectType: string, externalKey: string | null, violations: Violation[]) {
    const summary = violations.map((v) => `${v.code}@${v.path}`).join(", ");
    super(
      `Canonical object ${objectType}${externalKey ? ` (${externalKey})` : ""} violates ONT-001: ${summary}`,
    );
    this.name = "OntologySchemaError";
    this.objectType = objectType;
    this.externalKey = externalKey;
    this.violations = violations;
  }
}
