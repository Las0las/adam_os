// TelemetryEmitter — records projection-runtime lifecycle events (resolution,
// intent emission) without coupling the runtime to any particular sink. The
// composer emits through the TelemetrySink on the RuntimeContext; callers choose
// the sink (a server adapter that writes audit events, an in-memory collector for
// tests, or the default no-op). This keeps the pure runtime free of server deps.

import type { TelemetrySink } from "../contracts/context";

export interface TelemetryEvent {
  name: string;
  at: string;
  data?: Record<string, unknown>;
}

/** A buffering emitter usable as a TelemetrySink. Optionally forwards each event
 *  to a delegate (e.g. a server audit adapter). */
export class TelemetryEmitter implements TelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  constructor(private readonly delegate?: (event: TelemetryEvent) => void) {}

  emit(event: TelemetryEvent): void {
    this.events.push(event);
    try {
      this.delegate?.(event);
    } catch {
      // Telemetry SHALL NOT break resolution (fail-open).
    }
  }

  drain(): TelemetryEvent[] {
    return [...this.events];
  }
}

/** The default no-op sink, used when no telemetry is configured. */
export const NOOP_TELEMETRY: TelemetrySink = { emit() {} };
