// Universal Projection Runtime — public surface.
//
// Every enterprise object is rendered from metadata, every surface is a
// projection, every action emits a governed intent, and the runtime services own
// layout, permissions, validation, intelligence, lifecycle, and command emission.

export * from "./contracts";
export * from "./engines";

export { ProjectionRuntime } from "./runtime/projection-runtime";
export type { ResolveInput } from "./runtime/projection-runtime";
export { compose } from "./runtime/projection-composer";
export type { ComposeInput } from "./runtime/projection-composer";

export {
  registerEnterpriseObject,
  registerProjection,
  getEnterpriseObject,
  getProjection,
  listProjections,
  listEnterpriseObjects,
} from "./registry/projection-registry";
export {
  resolveProjection,
  ProjectionResolutionError,
} from "./registry/projection-resolver";
export type { ResolveByIdContexts } from "./registry/projection-resolver";

export { emitIntent } from "./intents/intent-emitter";
export type { IntentState, IntentEmissionResult } from "./intents/intent-emitter";

// Ensure object/projection definitions self-register when the runtime is imported.
import "./definitions/register";
