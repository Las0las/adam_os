// Prompt template registry (§31, §33). Templates use {{var}} interpolation.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import type { ActorContext } from "@/types/platform";
import type { PromptTemplate } from "@/types/aiops";

export function registerPrompt(
  ctx: ActorContext,
  input: { key: string; name: string; template: string; outputSchema?: Record<string, unknown> | null },
): PromptTemplate {
  requirePermission(ctx, "aiops.function_admin");
  const existing = db.promptTemplates.find(ctx.tenantId, (p) => p.key === input.key);
  if (existing) {
    return db.promptTemplates.update(existing.id, {
      name: input.name,
      template: input.template,
      outputSchema: input.outputSchema ?? null,
    });
  }
  return db.promptTemplates.insert({
    id: id("prompt"),
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    template: input.template,
    outputSchema: input.outputSchema ?? null,
    status: "active",
  });
}

export function getPrompt(ctx: ActorContext, key: string): PromptTemplate | undefined {
  return db.promptTemplates.find(ctx.tenantId, (p) => p.key === key);
}

/** Render a template with {{var}} placeholders. Missing vars render empty. */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}
