// Object mapper registry (§15 ontology/). A mapper projects a CanonicalRecord
// into one or more ontology objects/links — the DataOps -> Ontology boundary.

import type { ActorContext } from "@/types/platform";
import type { CanonicalRecord, OntologyObject } from "@/types/dataops";
import { recruitingObjectMapper } from "./recruiting-object-mapper";

export interface ObjectMapper {
  key: string;
  map(ctx: ActorContext, record: CanonicalRecord): OntologyObject[];
}

const registry = new Map<string, ObjectMapper>();

export function registerObjectMapper(mapper: ObjectMapper): void {
  registry.set(mapper.key, mapper);
}

export function resolveObjectMapper(key: string): ObjectMapper | undefined {
  return registry.get(key);
}

export function listObjectMappers(): ObjectMapper[] {
  return [...registry.values()];
}

registerObjectMapper(recruitingObjectMapper);
