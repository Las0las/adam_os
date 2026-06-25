// Phase 5 — Action execution trace wrapper (Part K). Thin specialization of
// RunTracePanel for action executions (surfaces result/blockedReason).

import { RunTracePanel, type TraceData } from "./RunTracePanel";

export function ActionExecutionTrace({ trace }: { trace: TraceData }) {
  return <RunTracePanel trace={trace} />;
}
