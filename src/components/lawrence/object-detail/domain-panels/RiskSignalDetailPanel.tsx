// Phase 5 — Risk signal domain panel (Part F). Executive-flavored summary:
// signal severity, the triggering rationale, and the account it affects.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString } from "../object-detail-format";

export function RiskSignalDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const severity = propString(props, "severity");
  const rationale = propString(props, "rationale") ?? propString(props, "summary") ?? propString(props, "description");
  const account = detail.relationships.find(
    (r) => r.objectType === "Account" || r.linkType.toLowerCase().includes("account"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Risk Signal</h3>
        <div className="kv"><span className="muted">Signal</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "category") ? (
          <div className="kv"><span className="muted">Category</span><span>{propString(props, "category")}</span></div>
        ) : null}
        {severity ? (
          <div className="kv">
            <span className="muted">Severity</span>
            <span className={`badge sev-${severity.toLowerCase()}`}>{severity}</span>
          </div>
        ) : null}
        {account ? (
          <div className="kv">
            <span className="muted">Account</span>
            <Link href={`/objects/${encodeURIComponent(account.objectType)}/${encodeURIComponent(account.objectId)}`}>
              {account.title ?? account.objectId}
            </Link>
          </div>
        ) : null}
      </div>

      {rationale ? (
        <div className="card">
          <h3>Rationale</h3>
          <div style={{ fontSize: 12 }}>{rationale}</div>
        </div>
      ) : null}
    </div>
  );
}
