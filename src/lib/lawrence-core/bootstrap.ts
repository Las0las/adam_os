// Demo bootstrap. Wires a tenant end-to-end across all three fabrics so the app
// and API surfaces have live data and the full path is exercised:
//   ingest CSV -> pipeline -> ontology -> evidence -> retrieval/function ->
//   action (approval-gated) -> review -> notification -> release.

import { db, resetDatabase } from "./db";
import { id, now, resetClock } from "./utils/ids";
import { systemActor } from "./permissions/permissions";
import { setModelProvider } from "@/lib/aiops/models/model-provider";
import { resolveDefaultProvider } from "@/lib/aiops/models/model-router";
import { registerSource, ingestAsset } from "@/lib/dataops/sources/source-service";
import { runAssetPipeline } from "@/lib/dataops/pipelines/pipeline-runner";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { createNotificationRule } from "@/lib/mission-control/notifications/notification-service";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import { installEvalSuites } from "@/lib/aiops/evals/eval-seed";
import "@/lib/mission-control/actions/builtins";
import {
  seedOnboarding,
  seedSupport,
  seedClaims,
  seedCommercial,
} from "@/lib/domains";
import "@/lib/domains/phase4-packs";
import { installAllDomainPacks } from "@/lib/domains/domain-seed-runner";

export const DEMO_TENANT_ID = "tnt_demo";

// The memo lives on globalThis (not a module-level let): Next.js bundling can
// duplicate this module across route chunks, and `db` is itself a process
// global, so a per-module memo could let two bootstrap() runs race on the shared
// store. A process-wide memo guarantees bootstrap runs exactly once per process.
const globalRef = globalThis as unknown as { __lawrenceBootstrap?: Promise<void> };

/** Idempotent: safe to call from any API route to ensure demo data exists. */
export function ensureBootstrapped(): Promise<void> {
  if (!globalRef.__lawrenceBootstrap) globalRef.__lawrenceBootstrap = bootstrap();
  return globalRef.__lawrenceBootstrap;
}

export async function bootstrap(): Promise<void> {
  await resetDatabase();
  resetClock();

  // Install the process-wide default model provider from the environment. With
  // no provider key set this is the deterministic mock, so local/test runs stay
  // key-free; with a key it transparently upgrades every getModelProvider()
  // caller to a real provider.
  setModelProvider(resolveDefaultProvider());

  const tenant = await db.tenants.insert({
    id: DEMO_TENANT_ID,
    tenantId: DEMO_TENANT_ID,
    name: "Demo Tenant",
    slug: "demo",
    createdAt: now(),
  });
  const ctx = systemActor(tenant.id);

  await db.users.insert({
    id: "usr_demo",
    tenantId: tenant.id,
    email: "operator@lawrence.dev",
    displayName: "Demo Operator",
    roleIds: ["role_admin"],
    createdAt: now(),
  });

  // DataOps: ingest a candidate CSV and run the canonical pipeline.
  const source = await registerSource(ctx, { name: "Candidate Upload", kind: "upload" });
  const csv = [
    "full_name,email,location,summary",
    "Ada Lovelace,ada@example.com,London,Analytical engine pioneer and mathematician",
    "Alan Turing,alan@example.com,Manchester,Computing theory and cryptanalysis expert",
    "Grace Hopper,grace@example.com,New York,Compiler inventor and systems programmer",
  ].join("\n");
  const asset = await ingestAsset(ctx, { fileName: "candidates.csv", content: csv, sourceId: source.id });

  await runAssetPipeline(ctx, asset, { ontologyMapper: "recruiting" });

  // Index each candidate's summary as evidence so retrieval/functions work.
  for (const candidate of await listObjects(ctx, "Candidate")) {
    const summary = String(candidate.properties.summary ?? candidate.title ?? "");
    if (summary) {
      await indexEvidence(ctx, { objectType: "Candidate", objectId: candidate.id }, summary, {
        documentTitle: candidate.title,
      });
    }
  }

  // Seed the remaining domain packs (onboarding / support / claims / commercial)
  // so every domain surface has live ontology objects and evidence.
  await seedOnboarding(ctx);
  await seedSupport(ctx);
  await seedClaims(ctx);
  await seedCommercial(ctx);

  // Phase 4: install the richer domain workflow packs (recruiting / onboarding /
  // support / claims / executive) — sample objects, evidence, functions, agents,
  // actions, and notification rules — for the demo tenant.
  await installAllDomainPacks(ctx);

  // Mission Control: notification rules for review cases and critical findings.
  await createNotificationRule(ctx, {
    name: "Review case opened",
    eventKey: "review_case.created",
    channel: "in_app",
    template: "A new review case requires attention: {{summary}}",
  });
  await createNotificationRule(ctx, {
    name: "Claim critical finding",
    eventKey: "claim.critical_finding",
    channel: "in_app",
    template: "Critical claim finding requires validator attention.",
  });
  await createNotificationRule(ctx, {
    name: "Onboarding blocker",
    eventKey: "onboarding.blocker",
    channel: "in_app",
    template: "Onboarding blocker escalated to the accountable owner.",
  });

  // Phase 6: install the Mission Control governance control plane (environments,
  // approval policies, runtime components) for the demo tenant.
  await installMissionControlGovernance(ctx);

  // Phase 7: seed default eval suites so the evals + observability surfaces have
  // live data for the demo tenant.
  await installEvalSuites(ctx);

  // A draft release bundle for the recruiting pack.
  await db.releaseBundles.insert({
    id: id("rel"),
    tenantId: tenant.id,
    name: "Recruiting pack v1",
    artifacts: [
      { kind: "function", id: "answer_with_citations", version: 1 },
      { kind: "agent", id: "shortlist_builder", version: 1 },
    ],
    environment: "draft",
    status: "draft",
    promotedFrom: null,
    createdAt: now(),
  });
}
