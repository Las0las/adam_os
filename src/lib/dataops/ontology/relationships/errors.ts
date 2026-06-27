// Typed error for ONT-002 relationship enforce-mode rejections. Thrown by
// linkObjects only when relationship enforcement is explicitly enabled for the
// tenant AND the relationship type is REGISTERED but used invalidly. Unregistered
// relationship types are never rejected (see ONT-002 §Validation / ADR-0008).
import type { Violation } from "../schemas/types";

export class RelationshipSchemaError extends Error {
  readonly linkType: string;
  readonly sourceType: string;
  readonly targetType: string;
  readonly violations: Violation[];

  constructor(linkType: string, sourceType: string, targetType: string, violations: Violation[]) {
    const summary = violations.map((v) => `${v.code}@${v.path}`).join(", ");
    super(
      `Relationship ${sourceType} --${linkType}--> ${targetType} violates ONT-002: ${summary}`,
    );
    this.name = "RelationshipSchemaError";
    this.linkType = linkType;
    this.sourceType = sourceType;
    this.targetType = targetType;
    this.violations = violations;
  }
}
