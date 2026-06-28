/**
 * @lawrence/contracts — RFC-PC0 Platform Contracts.
 *
 * The frozen, implementation-free interface layer the platform survives on. Nothing
 * here has behavior (except one frozen data constant: the CCR requirement set). The
 * eight contracts, three registries, the shrunk Kernel interface, and Host Services.
 */

// Shared primitives
export type * from "./common.js";

// The eight RFC-PC0 contracts
export type * from "./enterprise-object.js"; // 1. Enterprise Object Contract
export type * from "./mutation.js"; //          2. Mutation Contract
export type * from "./runtime.js"; //           3. Runtime Contract
export type * from "./projection.js"; //        4. Projection Contract
export type * from "./domain-pack.js"; //       5. Domain Pack Contract
export type * from "./capability.js"; //        6. Capability Contract
export type * from "./host-service.js"; //      7. Host Service Contract
export type * from "./constitutional-test.js"; // 8. Constitutional Test Contract (types)

// Decision + policy inputs to the Kernel
export type * from "./decision.js";
export type * from "./policy.js";

// The shrunk Kernel interface (implemented in @lawrence/kernel, Phase 1)
export type * from "./kernel.js";

// The three permanent registries
export type * from "./registries.js";

// The single frozen data export: the constitutional requirement set (CCR-001..004).
export { CONSTITUTIONAL_REQUIREMENTS } from "./constitutional-test.js";
