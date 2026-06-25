// Function runtime contract (§25–§27). A LawrenceFunction is a typed,
// ontology-backed unit of AI work: resolve context -> call model -> validate
// output -> (optionally) write back under policy.

import type { ActorContext } from "@/types/platform";
import type { RetrievalHit } from "@/types/dataops";

export interface FunctionExecutionContext {
  tenantId: string;
  actorUserId?: string | null;
}

export interface FunctionExecutionResult<TOutput = unknown> {
  output: TOutput;
  citations?: RetrievalHit[];
  trace?: Record<string, unknown>;
}

export interface LawrenceFunction<TInput = Record<string, unknown>, TOutput = unknown> {
  key: string;
  name: string;
  description: string;
  /** Class per §25.2. */
  klass: "summarize" | "extract" | "classify" | "reason" | "writeback" | "draft";
  outputSchema: Record<string, unknown>;
  run(ctx: ActorContext, input: TInput): Promise<FunctionExecutionResult<TOutput>>;
}
