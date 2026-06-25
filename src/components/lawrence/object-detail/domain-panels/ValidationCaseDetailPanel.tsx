// Phase 5 — Validation/claims case domain panel (Part F). Shows the claim under
// validation, its decision/findings, and grounding evidence.

import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString, statusTone } from "../object-detail-format";
import { EvidenceList } from "../../evidence/EvidenceList";

export function ValidationCaseDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const decision = propString(props, "decision") ?? propString(props, "outcome");
  const findings = propString(props, "findings") ?? propString(props, "rationale") ?? propString(props, "summary");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Validation Case</h3>
        <div className="kv"><span className="muted">Case</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "claimType") ? (
          <div className="kv"><span className="muted">Claim type</span><span>{propString(props, "claimType")}</span></div>
        ) : null}
        {propString(props, "amount") ? (
          <div className="kv"><span className="muted">Amount</span><span>{propString(props, "amount")}</span></div>
        ) : null}
        {decision ? (
          <div className="kv">
            <span className="muted">Decision</span>
            <span className={`badge ${statusTone(decision)}`}>{decision}</span>
          </div>
        ) : null}
      </div>

      {findings ? (
        <div className="card">
          <h3>Findings</h3>
          <div style={{ fontSize: 12 }}>{findings}</div>
        </div>
      ) : null}

      {detail.evidence.length > 0 ? (
        <div className="card">
          <h3>Evidence</h3>
          <EvidenceList evidence={detail.evidence} />
        </div>
      ) : null}
    </div>
  );
}
