// Phase 5 — Function run trace wrapper (Part K). Thin specialization of
// RunTracePanel for function runs.

import { RunTracePanel, type TraceData } from "./RunTracePanel";

export function FunctionRunTrace({ trace }: { trace: TraceData }) {
  return <RunTracePanel trace={trace} />;
}
