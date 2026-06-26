// Phase 10 — data classification + redaction contracts.

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted"
  | "pii"
  | "financial"
  | "health"
  | "legal"
  | "credential";

export type ClassificationSource = "manual" | "detector" | "policy" | "integration" | "import";

export interface DataClassificationRecord {
  id: string;
  tenantId: string;
  objectType?: string | null;
  objectId?: string | null;
  fieldPath?: string | null;
  classification: DataClassification;
  source: ClassificationSource;
  confidence?: number | null;
  createdBy?: string | null;
  createdAt: string;
}

export type RedactionStrategy = "mask" | "remove" | "hash" | "token" | "last4";

export interface RedactionRule {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  classification: DataClassification;
  strategy: RedactionStrategy;
  config: Record<string, unknown>;
  status: "active" | "inactive";
  createdAt: string;
}

export interface DetectorMatch {
  classification: DataClassification;
  fieldPath: string;
  confidence: number;
  /** A masked sample of the match — never the raw secret value. */
  maskedSample: string;
}
