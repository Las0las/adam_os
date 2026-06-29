/**
 * RFC-PC0 Contract 4 — Projection Contract.
 *
 * A Projection is a PURE, deterministic view derived from event history. The
 * constitutional guarantee (CCR-004): a projection's output always equals what the
 * event history implies — refreshing a projection from the log reproduces it exactly.
 * Projections are read-only: they never emit mutations.
 */
import type {
  ContentHash,
  Iso8601,
  ProjectionId,
  Sequence,
  TenantContext,
} from "./common.js";
import type { DomainEvent } from "./mutation.js";

/** How a projection is rendered/consumed — surface-independent. */
export type ProjectionShape = "table" | "timeline" | "kanban" | "calendar" | "graph" | "record";

export interface ProjectionDescriptor {
  readonly id: ProjectionId;
  readonly shape: ProjectionShape;
  readonly version: string;
  /** Object types this projection reads from. */
  readonly sources: readonly string[];
}

/** The deterministic fold a projection implements over the event log. */
export interface ProjectionContract<View = unknown> {
  readonly descriptor: ProjectionDescriptor;
  /**
   * Fold an ordered event slice into a view. MUST be a pure function of (events):
   * same events in, byte-identical view out. No clocks, no randomness, no I/O.
   */
  project(ctx: TenantContext, events: readonly DomainEvent[]): ProjectionResult<View>;
}

export interface ProjectionResult<View> {
  readonly view: View;
  /** Sequence of the last event folded — the projection's "as-of" watermark. */
  readonly throughSequence: Sequence;
  /** Hash of the view; equal hashes prove replay-equivalence. */
  readonly viewHash: ContentHash;
  readonly computedAt: Iso8601;
}
