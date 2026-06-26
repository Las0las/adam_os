// Phase 10 — deterministic sensitive-data detectors. Pattern-based only; returns
// a classification + confidence + a MASKED sample (never the raw value). These
// are candidates, not ground truth — confidence is conservative.

import type { DataClassification } from "./data-classification-types";

export interface DetectorHit {
  classification: DataClassification;
  confidence: number;
  maskedSample: string;
}

function mask(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

interface Detector {
  classification: DataClassification;
  confidence: number;
  pattern: RegExp;
}

const DETECTORS: Detector[] = [
  { classification: "pii", confidence: 0.9, pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ }, // email
  { classification: "pii", confidence: 0.7, pattern: /\b(?:\+?\d[ -]?){9,14}\d\b/ }, // phone-ish
  { classification: "pii", confidence: 0.8, pattern: /\b\d{3}-\d{2}-\d{4}\b/ }, // SSN-like
  { classification: "financial", confidence: 0.75, pattern: /\b(?:\d[ -]?){13,16}\b/ }, // card-like
  { classification: "financial", confidence: 0.6, pattern: /\b\d{9}\b/ }, // routing-like
  { classification: "credential", confidence: 0.97, pattern: /\bsk-[A-Za-z0-9]{20,}\b/ }, // OpenAI-style
  { classification: "credential", confidence: 0.97, pattern: /\bsk-ant-[A-Za-z0-9-]{20,}\b/ }, // Anthropic-style
  { classification: "credential", confidence: 0.9, pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/ }, // bearer token
  { classification: "credential", confidence: 0.95, pattern: /\bAKIA[0-9A-Z]{16}\b/ }, // AWS access key
  { classification: "credential", confidence: 0.99, pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ }, // private key
  { classification: "credential", confidence: 0.95, pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/ }, // slack webhook
  { classification: "health", confidence: 0.5, pattern: /\b(diagnosis|prescription|patient|referral|authorization)\b/i }, // health marker
  { classification: "legal", confidence: 0.5, pattern: /\b(contract|nda|litigation|settlement|privileged)\b/i }, // legal marker
];

/** Scan a single text value for sensitive patterns. */
export function detectInText(text: string): DetectorHit[] {
  const hits: DetectorHit[] = [];
  for (const d of DETECTORS) {
    const m = text.match(d.pattern);
    if (m) hits.push({ classification: d.classification, confidence: d.confidence, maskedSample: mask(m[0]) });
  }
  return hits;
}

/** Scan an object's string fields; returns hits keyed by field path. */
export function detectInObject(obj: Record<string, unknown>): Array<DetectorHit & { fieldPath: string }> {
  const out: Array<DetectorHit & { fieldPath: string }> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      for (const hit of detectInText(value)) out.push({ ...hit, fieldPath: key });
    }
  }
  return out;
}
