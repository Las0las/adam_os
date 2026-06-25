// Phase 5 — Agent run trace wrapper (Part K). Thin specialization of
// RunTracePanel for agent runs (surfaces steps).

import { RunTracePanel, type TraceData } from "./RunTracePanel";

export function AgentRunTrace({ trace }: { trace: TraceData }) {
  return <RunTracePanel trace={trace} />;
}
