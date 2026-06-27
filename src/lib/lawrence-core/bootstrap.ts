// Demo bootstrap. Wires a tenant end-to-end across all three fabrics so the app
// and API surfaces have live data and the full path is exercised:
//   ingest CSV -> pipeline -> ontology -> evidence -> retrieval/function ->
//   action (approval-gated) -> review -> notification -> release.

import { db, resetDatabase } from "./db";
import { runWithTenant } from "./db/tenant-store";
import { id, now, resetClock } from "./utils/ids";
import { systemActor } from "./permissions/permissions";
import { setModelProvider } from "@/lib/aiops/models/model-provider";
import { resolveDefaultProvider } from "@/lib/aiops/models/model-router";
import { installExecutionObservability } from "@/lib/aiops/execution/observability/observability-bootstrap";
import { installSecurityMiddleware } from "@/lib/aiops/security/security-bootstrap";
import { installPromptCache } from "@/lib/aiops/cache/cache-bootstrap";
import { installSemanticCache } from "@/lib/aiops/cache/semantic-bootstrap";
import { installBatchScheduler } from "@/lib/aiops/batch/batch-bootstrap";
import { installRetryMiddleware } from "@/lib/aiops/retry/retry-bootstrap";
import { installCircuitBreaker } from "@/lib/aiops/circuit/circuit-bootstrap";
import { installFallbackOrchestrator } from "@/lib/aiops/fallback/fallback-bootstrap";
import { installProviderHealthManager } from "@/lib/aiops/health/health-bootstrap";
import { installBenchmarkHarness } from "@/lib/aiops/benchmark/benchmark-bootstrap";
import { installExplainabilityEngine } from "@/lib/aiops/explainability/explainability-bootstrap";
import { installTrafficReplay } from "@/lib/aiops/replay/replay-bootstrap";
import { installEvaluationEngine } from "@/lib/aiops/evaluation/evaluation-bootstrap";
import { installModelCapabilityRegistry } from "@/lib/aiops/capability/capability-bootstrap";
import { installCostOptimizationEngine } from "@/lib/aiops/recommendation/cost-bootstrap";
import { registerSource, ingestAsset } from "@/lib/dataops/sources/source-service";
import { runAssetPipeline } from "@/lib/dataops/pipelines/pipeline-runner";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { createNotificationRule } from "@/lib/mission-control/notifications/notification-service";
import { installMissionControlGovernance } from "@/lib/mission-control/runtime/mission-control-seed";
import { installEvalSuites } from "@/lib/aiops/evals/eval-seed";
import { installSecuritySeeds } from "@/lib/security/security-seed";
import "@/lib/mission-control/actions/builtins";
import "@/lib/integrations/register-integrations";
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

/**
 * Fail-closed persistence guard. A production process MUST run against a durable
 * store: the in-memory backend loses all data per process and is never a valid
 * production target. Throws on the request path (not at build time — `next build`
 * sets NODE_ENV=production but issues no requests) unless durable Postgres is
 * configured or the operator explicitly opts into the ephemeral store.
 */
export function assertPersistenceReady(env: Record<string, string | undefined> = process.env): void {
  const isProduction = env.NODE_ENV === "production";
  const hasDurableStore = Boolean(env.DATABASE_URL); // mirrors isPostgresConfigured()
  if (isProduction && !hasDurableStore && env.LAWRENCE_ALLOW_MEMORY_STORE !== "1") {
    throw new Error(
      "Production persistence not configured: set DATABASE_URL (durable Postgres) " +
        "or set LAWRENCE_ALLOW_MEMORY_STORE=1 to explicitly accept the ephemeral in-memory store.",
    );
  }
}

/**
 * Whether `ensureBootstrapped()` should run the destructive demo seed
 * (`resetDatabase()` + sample data). This is demo scaffolding: it is only ever
 * appropriate against the ephemeral in-memory backend (local/dev/test/demo).
 * Against a configured Postgres it must NEVER run on the request path — doing so
 * would wipe real data on every cold start. Production data is provisioned
 * explicitly via `npm run seed` / `bootstrap()`.
 */
export function shouldAutoSeedDemo(env: Record<string, string | undefined> = process.env): boolean {
  if (env.LAWRENCE_DISABLE_DEMO_SEED === "1") return false;
  return !env.DATABASE_URL; // in-memory backend only
}

/**
 * Idempotent runtime initialization, safe to call from any API route. On the
 * ephemeral in-memory backend it runs the demo bootstrap so the surfaces have
 * live data (unchanged dev/test/demo behavior). On a configured Postgres it is
 * NON-DESTRUCTIVE: it never resets/reseeds; it only installs the process-wide
 * model-provider singleton so functions/agents can run against persisted data.
 */
export function ensureBootstrapped(): Promise<void> {
  if (!globalRef.__lawrenceBootstrap) globalRef.__lawrenceBootstrap = initRuntime();
  return globalRef.__lawrenceBootstrap;
}

async function initRuntime(): Promise<void> {
  assertPersistenceReady();
  // Attach the passive observability stack to the execution pipeline so every
  // inference automatically produces telemetry, metrics, audit, and health
  // observations. Idempotent and observation-only — it changes no behavior.
  installExecutionObservability();
  // Attach the security middleware (prompt firewall → PII redaction →
  // provider → response validator). Idempotent; the default policy is
  // non-disruptive (blocks only malicious prompts, detect-only PII, permissive
  // validation), so legitimate traffic is unaffected.
  installSecurityMiddleware();
  // Attach the prompt cache as the outermost middleware. Idempotent; the
  // default policy is DISABLED, so it is a no-op until a tenant enables it —
  // and it never bypasses the security middleware on a hit.
  installPromptCache();
  // Register the Semantic Cache store (IOS-009) on the cache registry, after the
  // exact-match store. Additive: the CacheManager/pipeline are unchanged. No-op
  // unless caching is enabled.
  installSemanticCache();
  // Attach the batch scheduler (IOS-008) after the cache and before security.
  // Idempotent; the default policy is DISABLED, so it is a no-op until a tenant
  // enables it — and it never bypasses security, validation, telemetry, or audit.
  installBatchScheduler();
  // Attach the retry middleware (IOS-010) after security, wrapping the provider
  // call via the ADR-0003 aroundInvoke hook. Idempotent; default policy DISABLED
  // (no-op). It never bypasses security/validation/telemetry/audit or re-runs
  // routing.
  installRetryMiddleware();
  // Attach the circuit breaker (IOS-011) after security, OUTSIDE retry (priority
  // 2.4 < retry 2.5), wrapping the provider call via the ADR-0003 aroundInvoke
  // hook. Idempotent; default policy DISABLED (no-op). When tripped it fast-fails
  // without invoking the provider or consuming retry attempts, and never re-runs
  // routing or bypasses security/validation/telemetry/audit.
  installCircuitBreaker();
  // Attach the fallback orchestrator (IOS-012) after the circuit breaker and
  // outside retry (priority 2.45), via the ADR-0003 aroundInvoke hook + ADR-0004
  // invocation-target override. Idempotent; default policy DISABLED (no-op). On a
  // transient/unavailable primary failure it redirects to alternate AUTHORIZED
  // targets in deterministic policy order; it never re-runs routing, mutates the
  // RoutingDecision, or bypasses security/validation/telemetry/audit.
  installFallbackOrchestrator();
  // Attach the Provider Health Manager (IOS-013) as a bus subscriber. Purely
  // observational: it folds execution/retry/circuit/fallback events into immutable
  // ProviderHealth snapshots and publishes health events. It registers NO
  // execution hook and changes no execution behavior; default policy DISABLED
  // (no-op). It never routes, invokes providers, or touches the Execution Plan.
  installProviderHealthManager();
  // Install the Benchmark Harness (IOS-014): subscribe its metrics collector to
  // the bus and expose the on-demand harness + result store. It is NOT an
  // execution hook and changes no execution behavior; default policy DISABLED, so
  // runs are a no-op until enabled. It drives cases through the public pipeline,
  // never invoking providers directly or influencing production routing.
  installBenchmarkHarness();
  // Attach the Explainability Engine (IOS-015) as a bus subscriber. Purely
  // observational: it correlates per-execution events into immutable Explanation
  // records and publishes explanation.produced. It registers NO execution hook and
  // changes no execution behavior; default policy DISABLED. It reads the canonical
  // objects (RoutingDecision/ExecutionPlan, ProviderHealth by reference) without
  // mutating them, and never routes or invokes providers.
  installExplainabilityEngine();
  // Install the Traffic Replay Engine (IOS-016) around a DEDICATED replay bus.
  // Replay-scoped observers subscribe to the replay bus only — nothing here
  // touches the production bus, so replays can never contaminate production health
  // (IOS-013) or production metrics. The engine replays recorded inputs through
  // the public pipeline (never invoking providers directly), default DISABLED.
  installTrafficReplay();
  // Install the Evaluation Engine (IOS-017) around a DEDICATED evaluation bus
  // (an Isolated Execution Environment, IOS-016 model). It scores completed
  // executions and produces the canonical EvaluationResult/Report; its observers
  // subscribe to the evaluation bus only, so production health/metrics are never
  // contaminated. Observational: no routing, no target authorization, no direct
  // provider invocation. Default policy DISABLED.
  installEvaluationEngine();
  // Install the Model Capability Registry (IOS-018) — the canonical producer of
  // ModelCapability/ModelDescriptor metadata, implementing the IOS-002 contract.
  // Declarative: it registers NO execution hook, changes no execution behavior,
  // and does NOT influence routing (routing keeps consuming capability metadata
  // via the existing IOS-001/002 contracts). Populated on demand from published
  // provider declarations.
  installModelCapabilityRegistry();
  // Install the Cost Optimization Engine (IOS-019) — the canonical producer of
  // CostRecommendation (first specialization of the Recommendation family). Purely
  // advisory: it registers NO execution hook, changes no execution behavior, never
  // influences routing or authorizes targets. Default policy DISABLED; it consumes
  // published metadata + execution/benchmark/health/evaluation evidence on demand.
  installCostOptimizationEngine();
  if (shouldAutoSeedDemo()) {
    await bootstrap();
    return;
  }
  // Postgres path: data already lives in the durable store. Do not touch it —
  // just ensure the model provider is installed (idempotent).
  setModelProvider(resolveDefaultProvider());
}

export async function bootstrap(): Promise<void> {
  // Bind the demo tenant for the whole seed so the Postgres backend sets the
  // RLS GUC for every write (including update/getById) under one tenant.
  return runWithTenant(DEMO_TENANT_ID, bootstrapInner);
}

async function bootstrapInner(): Promise<void> {
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

  // Phase 10: install the security control plane (security policies, scoped roles
  // + group, object access policies, sample classifications, retention policies).
  await installSecuritySeeds(ctx);

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
