// Pipeline preview (§18). Parses an asset and applies transforms WITHOUT
// persisting anything, returning a bounded sample for UI preview panes.

import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { resolveParser } from "../parsers/parser-registry";
import { resolveTransform } from "../transforms/transform-registry";
import type { ActorContext } from "@/types/platform";
import type { RawAsset } from "@/types/dataops";
import type { CanonicalParseOutput } from "../parsers/parser-types";

const PREVIEW_LIMIT = 20;

export interface PreviewOptions {
  transforms?: Array<{ key: string; config: Record<string, unknown> }>;
}

export interface PreviewResult {
  document?: CanonicalParseOutput["document"];
  records: Record<string, unknown>[];
}

export async function previewAsset(
  ctx: ActorContext,
  asset: RawAsset,
  opts: PreviewOptions = {},
): Promise<PreviewResult> {
  requirePermission(ctx, "dataops.admin");

  const parser = resolveParser(asset);
  if (!parser) throw new Error(`No parser for asset kind: ${asset.kind}`);
  const parsed = await parser.parse(asset);

  let rows = (parsed.records ?? []).map((r) => r.payload);
  if (opts.transforms?.length) {
    for (const step of opts.transforms) {
      const transform = resolveTransform(step.key);
      if (!transform) throw new Error(`Unknown transform: ${step.key}`);
      rows = (await transform.run({ rows, config: step.config }, ctx)).rows;
    }
  }

  return {
    document: parsed.document,
    records: rows.slice(0, PREVIEW_LIMIT),
  };
}
