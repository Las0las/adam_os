/**
 * @lawrence/workspace — the Universal Workspace host (Phase 0 placeholder).
 *
 * The workspace is a PROJECTION host: it renders runtimes and routes intent to
 * the kernel through the kernel's PUBLIC surface only. It must never reach into
 * kernel internals (the append-only ledger store, etc.). This is the system's
 * load-bearing layering rule — proven by the protected architectural test in
 * this package and by dependency-cruiser.
 *
 * Allowed kernel import: the public barrel.
 */
import { KERNEL_PUBLIC_API, type KernelPublicMethod } from "@lawrence/kernel";
import type { ProjectionContract } from "@lawrence/contracts";

/** The workspace only ever speaks to the kernel via its published methods. */
export function kernelMethods(): readonly KernelPublicMethod[] {
  return KERNEL_PUBLIC_API;
}

/** A workspace pane is just a registered projection surface. */
export interface WorkspacePane {
  readonly paneId: string;
  readonly projection: ProjectionContract;
}

export type { ProjectionContract };
