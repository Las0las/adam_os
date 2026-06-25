import type { PipelineTransform } from "./transform-types";
import { builtinTransforms } from "./builtins";

const registry = new Map<string, PipelineTransform>();
for (const t of builtinTransforms) registry.set(t.key, t);

export function registerTransform(transform: PipelineTransform): void {
  registry.set(transform.key, transform);
}

export function resolveTransform(key: string): PipelineTransform | undefined {
  return registry.get(key);
}

export function listTransforms(): PipelineTransform[] {
  return [...registry.values()];
}
