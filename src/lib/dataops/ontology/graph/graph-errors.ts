// Typed error for the Graph Integrity Engine (VS-005 / ADR-0009). Thrown by
// validateGraph only in enforce mode when the graph has error-severity findings.
import type { GraphFinding, GraphIntegrityReport } from "./graph-types";

export class GraphIntegrityError extends Error {
  /** Distinct codes present among the error-severity findings. */
  readonly codes: string[];
  readonly errors: GraphFinding[];
  readonly report: GraphIntegrityReport;

  constructor(report: GraphIntegrityReport) {
    const codes = [...new Set(report.errors.map((e) => e.code))].sort();
    super(
      `Enterprise graph failed integrity validation: ${report.errors.length} error(s) [${codes.join(", ")}]`,
    );
    this.name = "GraphIntegrityError";
    this.codes = codes;
    this.errors = report.errors;
    this.report = report;
  }
}
