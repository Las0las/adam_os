// IOS-017 — Evaluation Engine — in-memory evaluation store.
//
// Holds immutable EvaluationResults and EvaluationReports. Read-only to consumers;
// the engine writes. In-memory only (no external persistence).

import type { EvaluationReport, EvaluationResult } from "./evaluation-types";

export class EvaluationStore {
  private readonly results: EvaluationResult[] = [];
  private readonly reports = new Map<string, EvaluationReport>();

  addResult(result: EvaluationResult): void {
    this.results.push(result);
  }

  addReport(report: EvaluationReport): void {
    this.reports.set(report.evaluationId, report);
  }

  getReport(evaluationId: string): EvaluationReport | null {
    return this.reports.get(evaluationId) ?? null;
  }

  resultsFor(evaluationId: string): EvaluationResult[] {
    return this.results.filter((r) => r.evaluationId === evaluationId);
  }

  allReports(): EvaluationReport[] {
    return [...this.reports.values()];
  }

  reset(): void {
    this.results.length = 0;
    this.reports.clear();
  }
}
