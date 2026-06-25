// Phase 5 — Account domain panel (Part F). Executive-flavored summary: risk
// score, account memos, and linked risk signals.

import Link from "next/link";
import type { ObjectDetail } from "@/lib/domains/object-detail/object-detail-types";
import { propString, stringifyValue } from "../object-detail-format";

export function AccountDetailPanel({ detail }: { detail: ObjectDetail }) {
  const props = detail.object.properties;
  const riskScore = props.riskScore ?? props.risk_score ?? props.risk;
  const memos = props.memos ?? props.notes;
  const memoList = Array.isArray(memos) ? memos : memos ? [memos] : [];
  const signals = detail.relationships.filter(
    (r) => r.objectType === "RiskSignal" || r.linkType.toLowerCase().includes("risk"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <h3>Account</h3>
        <div className="kv"><span className="muted">Name</span><span>{detail.object.title ?? detail.object.objectId}</span></div>
        {propString(props, "segment") ? (
          <div className="kv"><span className="muted">Segment</span><span>{propString(props, "segment")}</span></div>
        ) : null}
        {propString(props, "owner") ? (
          <div className="kv"><span className="muted">Owner</span><span>{propString(props, "owner")}</span></div>
        ) : null}
        {riskScore !== null && riskScore !== undefined ? (
          <div className="kv"><span className="muted">Risk score</span><span>{stringifyValue(riskScore)}</span></div>
        ) : null}
      </div>

      {memoList.length > 0 ? (
        <div className="card">
          <h3>Memos</h3>
          {memoList.map((m, i) => (
            <div className="kv" key={i}><span className="muted">#{i + 1}</span><span>{stringifyValue(m)}</span></div>
          ))}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="card">
          <h3>Risk signals ({signals.length})</h3>
          {signals.map((s, i) => (
            <div className="row" key={`${s.objectId}:${i}`}>
              <span className="muted" style={{ fontSize: 12 }}>{s.linkType}</span>
              <Link href={`/objects/${encodeURIComponent(s.objectType)}/${encodeURIComponent(s.objectId)}`} style={{ fontSize: 12 }}>
                {s.title ?? s.objectId}
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
