// Transform registry contract (§16).

export interface TransformContext {
  tenantId: string;
  actorUserId?: string | null;
}

export interface TransformInput {
  rows: Record<string, unknown>[];
  config: Record<string, unknown>;
}

export interface TransformOutput {
  rows: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface PipelineTransform {
  key: string;
  label: string;
  run(input: TransformInput, ctx: TransformContext): Promise<TransformOutput>;
}
