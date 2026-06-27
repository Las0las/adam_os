// Canonical object schema registry (ONT-001). Maps objectType -> schema for the
// four foundational canonical objects. Object types without a registered schema
// are intentionally not validated (unchanged behavior) until a future ONT spec
// adds them.

import type { CanonicalObjectSchema } from "./types";
import { candidateSchema } from "./candidate.schema";
import { jobSchema } from "./job.schema";
import { submissionSchema } from "./submission.schema";
import { accountSchema } from "./account.schema";

const REGISTRY: ReadonlyMap<string, CanonicalObjectSchema> = new Map(
  [candidateSchema, jobSchema, submissionSchema, accountSchema].map((s) => [s.objectType, s]),
);

/** The canonical schema for an objectType, or undefined if unregistered. */
export function schemaFor(objectType: string): CanonicalObjectSchema | undefined {
  return REGISTRY.get(objectType);
}

/** The objectTypes that currently have a registered canonical schema. */
export function registeredObjectTypes(): string[] {
  return [...REGISTRY.keys()];
}

export type { CanonicalObjectSchema, CanonicalObjectInput, Violation } from "./types";
