// Phase 4 — domain seed runner (Part A2). Installs a DomainSeedPack idempotently
// for a tenant: ontology objects + evidence, function/agent/action definition
// rows (for UI listing), prompt templates, and notification rules. The actual
// function/action handlers self-register in code; this persists their metadata.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { emitAudit } from "@/lib/lawrence-core/audit/audit-service";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { registerPrompt } from "@/lib/aiops/prompts/prompt-service";
import { createNotificationRule } from "@/lib/mission-control/notifications/notification-service";
import { seedObjectEvidence } from "./domain-fixtures";
import type { ActorContext } from "@/types/platform";
import type { DomainSeedPack } from "./domain-seed-types";

const registry = new Map<string, DomainSeedPack>();

export function registerDomainSeedPack(pack: DomainSeedPack): void {
  registry.set(pack.key, pack);
}

export function listDomainSeedPacks(): DomainSeedPack[] {
  return [...registry.values()];
}

/** Install a single pack. Idempotent: keyed on (tenant, key/externalKey). */
export async function seedDomainPack(ctx: ActorContext, pack: DomainSeedPack): Promise<void> {
  // 1) Sample ontology objects + their evidence.
  for (const obj of pack.sampleObjects) {
    const created = await upsertObject(ctx, {
      objectType: obj.objectType,
      externalKey: obj.externalKey,
      title: obj.title,
      status: obj.status ?? null,
      properties: obj.properties,
    });
    if (obj.evidence?.length) {
      await seedObjectEvidence(ctx, obj.objectType, created.id, obj.evidence, {
        documentTitle: obj.title,
      });
    }
  }

  // 2) Function / agent / action definition rows (metadata for Studio listing).
  for (const fn of pack.functions) {
    if (!(await db.aiFunctions.find(ctx.tenantId, (r) => r.key === fn.key))) {
      await db.aiFunctions.insert({
        id: id("aifn"),
        tenantId: ctx.tenantId,
        key: fn.key,
        name: fn.name,
        description: fn.description,
        inputSchema: fn.inputSchema,
        outputSchema: fn.outputSchema,
        promptTemplateId: fn.promptTemplateKey ?? null,
        retrievalPolicyId: fn.retrievalPolicyKey ?? null,
        writebackPolicyId: null,
        status: "active",
        createdAt: now(),
      });
    }
  }
  for (const agent of pack.agents) {
    if (!(await db.agentDefinitions.find(ctx.tenantId, (r) => r.key === agent.key))) {
      await db.agentDefinitions.insert({
        id: id("agentdef"),
        tenantId: ctx.tenantId,
        key: agent.key,
        name: agent.name,
        description: agent.description,
        graph: agent.graph as never,
        status: "active",
        createdAt: now(),
      });
    }
  }
  for (const action of pack.actions) {
    if (!(await db.actionDefinitions.find(ctx.tenantId, (r) => r.key === action.key))) {
      await db.actionDefinitions.insert({
        id: id("actdef"),
        tenantId: ctx.tenantId,
        key: action.key,
        name: action.name,
        objectType: action.objectType ?? null,
        inputSchema: action.inputSchema,
        approvalPolicyId: action.approvalPolicyKey ?? null,
        requiredPermission: null,
        createdAt: now(),
      });
    }
  }

  // 3) Notification rules (idempotent by name) + their templates.
  for (const rule of pack.notificationRules) {
    const exists = await db.notificationRules.find(ctx.tenantId, (r) => r.name === rule.name);
    if (!exists) {
      await createNotificationRule(ctx, {
        name: rule.name,
        eventKey: rule.eventType,
        channel: rule.channel === "teams" ? "teams" : rule.channel,
        template: rule.template ?? `${rule.name}: {{summary}}`,
      });
    }
    await registerPrompt(ctx, {
      key: rule.templateKey,
      name: rule.name,
      template: rule.template ?? `${rule.name}: {{summary}}`,
    });
  }

  await emitAudit(ctx, "domain.seed_pack.installed", { type: "domain_seed_pack", id: pack.key }, {
    objects: pack.sampleObjects.length,
    functions: pack.functions.length,
    agents: pack.agents.length,
    actions: pack.actions.length,
    rules: pack.notificationRules.length,
  });
}

/** Install every registered pack for a tenant. */
export async function installAllDomainPacks(ctx: ActorContext): Promise<void> {
  for (const pack of registry.values()) {
    await seedDomainPack(ctx, pack);
  }
}
