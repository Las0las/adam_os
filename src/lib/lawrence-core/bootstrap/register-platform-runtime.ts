// Centralized runtime registration (Phase 2 §58). Importing this module forces
// every registry to be populated: parsers, transforms, AI functions, actions,
// object mappers, and all domain packs. Registration happens via side-effect
// imports; this module makes the wiring explicit and call-once safe.

import "@/lib/dataops/parsers/parser-registry";
import "@/lib/dataops/transforms/transform-registry";
import "@/lib/aiops/functions/function-registry";
import "@/lib/dataops/ontology/object-mapper-registry";
import "@/lib/domains";

let registered = false;

/** Idempotent. Safe to call from any server-side startup point. */
export function registerPlatformRuntime(): void {
  // The imports above already populate the registries at module load; this
  // function exists so callers have an explicit, intention-revealing entry.
  registered = true;
}

export function isPlatformRuntimeRegistered(): boolean {
  return registered;
}
