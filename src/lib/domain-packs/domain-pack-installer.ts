// Phase 8 — domain pack installer. Validates the manifest, installs the
// underlying runtime (reusing the Phase 4 DomainSeedPack when present), marks
// demo objects, installs eval suites, and records an idempotent installation.
// Fail-closed: an invalid manifest never touches tenant data.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { requirePermission } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { listDomainSeedPacks, seedDomainPack } from "@/lib/domains/domain-seed-runner";
import { createNotificationRule } from "@/lib/mission-control/notifications/notification-service";
import { createEvalSuite } from "@/lib/aiops/evals/eval-run-repository";
import { createEvalCase } from "@/lib/aiops/evals/eval-case-repository";
import { validateManifest } from "./domain-pack-validation";
import { auditPackInstalled } from "./domain-pack-audit";
import type { ActorContext } from "@/types/platform";
import type { DomainObjectSeed } from "@/lib/domains/domain-seed-types";
import type { DomainPackInstallation, DomainPackManifest } from "./domain-pack-types";

/** Seed demo objects, tagging each as demo + pack-owned for filtering/reset. */
async function installDemoObjects(
  ctx: ActorContext,
  packKey: string,
  objects: DomainObjectSeed[],
): Promise<number> {
  let count = 0;
  for (const obj of objects) {
    await upsertObject(ctx, {
      objectType: obj.objectType,
      externalKey: obj.externalKey,
      title: obj.title,
      status: obj.status ?? null,
      properties: { ...obj.properties, __demo: true, __packKey: packKey },
    });
    count += 1;
  }
  return count;
}

async function installEvalSuites(ctx: ActorContext, manifest: DomainPackManifest): Promise<void> {
  for (const suite of manifest.evalSuites) {
    const created = await createEvalSuite({
      tenantId: ctx.tenantId,
      key: suite.key,
      name: suite.name,
      suiteType: suite.suiteType,
      targetComponentType: "function",
      targetComponentKey: suite.targetComponentKey,
      baselineConfig: { averageScore: suite.baselineScore },
    });
    for (const c of suite.cases ?? []) {
      await createEvalCase({
        tenantId: ctx.tenantId,
        suiteType: suite.suiteType,
        suiteKey: created.key,
        input: c.input,
        expected: c.expected,
      });
    }
  }
}

export interface InstallPackResult {
  installation: DomainPackInstallation;
  alreadyInstalled: boolean;
}

export async function installDomainPack(
  ctx: ActorContext,
  manifest: DomainPackManifest,
  opts: { actorUserId?: string | null } = {},
): Promise<InstallPackResult> {
  requirePermission(ctx, "dataops.admin");

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid domain pack manifest '${manifest.key}': ${validation.errors.join("; ")}`);
  }

  // Idempotent by (tenant, packKey, version).
  const existing = await db.domainPackInstallations.find(
    ctx.tenantId,
    (i) => i.packKey === manifest.key && i.packVersion === manifest.version && i.status === "installed",
  );
  if (existing) return { installation: existing, alreadyInstalled: true };

  // 1) Underlying runtime (functions/agents/actions/notif rows + objects).
  if (manifest.seedPackKey) {
    const seedPack = listDomainSeedPacks().find((p) => p.key === manifest.seedPackKey);
    if (!seedPack) throw new Error(`seed pack not found: ${manifest.seedPackKey}`);
    await seedDomainPack(ctx, seedPack);
    // Mark the seed pack's sample objects as demo (merge preserves properties).
    await installDemoObjects(ctx, manifest.key, seedPack.sampleObjects);
  }

  // 2) Pack-owned demo objects (new packs without a seed pack).
  await installDemoObjects(ctx, manifest.key, manifest.sampleObjects);

  // 3) Notification rules declared directly on the manifest.
  for (const rule of manifest.notificationRules) {
    const exists = await db.notificationRules.find(ctx.tenantId, (r) => r.name === rule.name);
    if (!exists) {
      await createNotificationRule(ctx, {
        name: rule.name,
        eventKey: rule.eventKey,
        channel: rule.channel,
        template: rule.template,
      });
    }
  }

  // 4) Eval suites + cases.
  await installEvalSuites(ctx, manifest);

  // 5) Record installation.
  const installation = await db.domainPackInstallations.insert({
    id: id("pkinst"),
    tenantId: ctx.tenantId,
    packKey: manifest.key,
    packVersion: manifest.version,
    status: "installed",
    installedBy: opts.actorUserId ?? ctx.actorUserId ?? null,
    installedAt: now(),
    disabledAt: null,
    uninstalledAt: null,
    metadata: { category: manifest.category },
  });

  await auditPackInstalled(ctx, installation.id, manifest.key, manifest.version);
  return { installation, alreadyInstalled: false };
}
