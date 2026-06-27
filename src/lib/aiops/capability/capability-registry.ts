// IOS-018 — Model Capability Registry — the canonical producer.
//
// Produces canonical ModelCapability records (and exposes ModelDescriptor metadata)
// by reading PUBLISHED provider declarations (IOS-001/002), and OPTIONALLY enriches
// them with declarative benchmark (IOS-014) and evaluation (IOS-017) observations.
// It reads all inputs by reference and mutates none of them; produced records are
// immutable. It is declarative — it does NOT influence routing, invoke providers,
// or alter any consumed object.

import { deepFreeze } from "@/lib/aiops/routing/routing-types";
import type { ProviderRegistry } from "@/lib/aiops/providers/provider-registry";
import type { BenchmarkResult } from "@/lib/aiops/benchmark/benchmark-types";
import type { EvaluationReport } from "@/lib/aiops/evaluation/evaluation-types";
import { ModelCapabilityStore } from "./capability-store";
import { capabilityKey, deriveCapability, type ModelCapability } from "./capability-types";

export class ModelCapabilityRegistry {
  constructor(private readonly store: ModelCapabilityStore = new ModelCapabilityStore()) {}

  /**
   * Produce canonical ModelCapability records from the published provider
   * declarations. Reads the provider registry by reference; mutates nothing.
   * Replaces any previously derived records (idempotent for a given registry).
   */
  buildFrom(registry: ProviderRegistry): this {
    for (const provider of registry.list()) {
      for (const descriptor of provider.descriptors) {
        this.store.set(deepFreeze(deriveCapability(descriptor)), descriptor);
      }
    }
    return this;
  }

  /**
   * Enrich existing capabilities with declarative benchmark observations
   * (IOS-014). Reads results by reference; produces NEW immutable records.
   */
  enrichFromBenchmark(results: BenchmarkResult[]): this {
    const byKey = new Map<string, { sum: number; runs: number }>();
    for (const r of results) {
      const key = capabilityKey(r.provider, r.model);
      const agg = byKey.get(key) ?? { sum: 0, runs: 0 };
      agg.sum += r.normalizedScore;
      agg.runs += 1;
      byKey.set(key, agg);
    }
    for (const cap of this.store.all()) {
      const agg = byKey.get(capabilityKey(cap.provider, cap.model));
      if (!agg) continue;
      const descriptor = this.store.descriptor(cap.provider, cap.model);
      if (!descriptor) continue;
      const next: ModelCapability = { ...cap, benchmark: { runs: agg.runs, averageScore: agg.sum / agg.runs } };
      this.store.set(deepFreeze(next), descriptor);
    }
    return this;
  }

  /**
   * Enrich existing capabilities with declarative evaluation observations
   * (IOS-017), aggregated per provider. Reads reports by reference; produces NEW
   * immutable records.
   */
  enrichFromEvaluation(reports: EvaluationReport[]): this {
    const byProvider = new Map<string, { sum: number; reports: number }>();
    for (const report of reports) {
      for (const [provider, agg] of Object.entries(report.byProvider)) {
        const acc = byProvider.get(provider) ?? { sum: 0, reports: 0 };
        acc.sum += agg.passRate;
        acc.reports += 1;
        byProvider.set(provider, acc);
      }
    }
    for (const cap of this.store.all()) {
      const acc = byProvider.get(cap.provider);
      if (!acc) continue;
      const descriptor = this.store.descriptor(cap.provider, cap.model);
      if (!descriptor) continue;
      const next: ModelCapability = { ...cap, evaluation: { reports: acc.reports, passRate: acc.sum / acc.reports } };
      this.store.set(deepFreeze(next), descriptor);
    }
    return this;
  }

  /** The canonical capability store (read-only access for consumers). */
  capabilities(): ModelCapabilityStore {
    return this.store;
  }
}
