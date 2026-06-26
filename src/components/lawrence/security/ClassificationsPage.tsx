"use client";

// Phase 10 — data classification explorer client root. Look up the effective
// classification + records for an object (GET), and classify an object/field
// (POST), refetching the lookup on settle.

import { useCallback, useState } from "react";
import { useClassifications } from "@/components/lawrence/hooks/useClassifications";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type { DataClassification } from "@/components/lawrence/hooks/securityTypes";

const CLASSIFICATIONS: DataClassification[] = [
  "public",
  "internal",
  "confidential",
  "pii",
  "financial",
  "legal",
  "health",
  "restricted",
  "credential",
];

export function ClassificationsPage() {
  const lookup = useClassifications();
  const noop = useCallback(() => {}, []);
  const actions = useSecurityActions(noop);

  // Lookup form state.
  const [lObjectType, setLObjectType] = useState("");
  const [lObjectId, setLObjectId] = useState("");

  // Classify form state.
  const [cObjectType, setCObjectType] = useState("");
  const [cObjectId, setCObjectId] = useState("");
  const [fieldPath, setFieldPath] = useState("");
  const [classification, setClassification] = useState<DataClassification>("internal");
  const [confidence, setConfidence] = useState("");
  const [classifyMsg, setClassifyMsg] = useState<string | null>(null);

  const submitLookup = () => {
    if (!lObjectType.trim() || !lObjectId.trim()) return;
    lookup.load(lObjectType.trim(), lObjectId.trim());
  };

  const submitClassify = async () => {
    setClassifyMsg(null);
    const parsedConfidence = confidence.trim() ? Number(confidence) : undefined;
    const res = await actions.post("/api/security/classifications", {
      objectType: cObjectType.trim(),
      objectId: cObjectId.trim(),
      fieldPath: fieldPath.trim() || undefined,
      classification,
      confidence: Number.isFinite(parsedConfidence) ? parsedConfidence : undefined,
    });
    if (res.ok) {
      setClassifyMsg("Classification saved.");
      // Refresh the lookup if it matches the just-classified object.
      if (
        lObjectType.trim() === cObjectType.trim() &&
        lObjectId.trim() === cObjectId.trim() &&
        lObjectType.trim()
      ) {
        lookup.load(lObjectType.trim(), lObjectId.trim());
      }
    } else {
      setClassifyMsg(res.error ?? "Failed to save classification.");
    }
  };

  return (
    <>
      <PageHeader
        title="Data classifications"
        sub="Explore effective classifications and classify objects or fields."
      />

      <div className="card">
        <strong>Classify object / field</strong>
        <label className="kv">
          <span className="muted">Object type</span>
          <input value={cObjectType} onChange={(e) => setCObjectType(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Object id</span>
          <input value={cObjectId} onChange={(e) => setCObjectId(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Field path (optional)</span>
          <input value={fieldPath} onChange={(e) => setFieldPath(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Classification</span>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value as DataClassification)}
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="kv">
          <span className="muted">Confidence (0–1, optional)</span>
          <input
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            placeholder="e.g. 0.9"
          />
        </label>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={actions.pending || !cObjectType.trim() || !cObjectId.trim()}
            onClick={submitClassify}
          >
            Save classification
          </button>
        </div>
        {classifyMsg ? (
          <p className="badge" style={{ marginTop: 8 }}>
            {classifyMsg}
          </p>
        ) : null}
      </div>

      <div className="card">
        <strong>Look up classification</strong>
        <div className="btn-row">
          <input
            placeholder="object type"
            value={lObjectType}
            onChange={(e) => setLObjectType(e.target.value)}
          />
          <input
            placeholder="object id"
            value={lObjectId}
            onChange={(e) => setLObjectId(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={lookup.loading || !lObjectType.trim() || !lObjectId.trim()}
            onClick={submitLookup}
          >
            Look up
          </button>
        </div>
        {lookup.error ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {lookup.error}
          </p>
        ) : null}
        {lookup.data ? (
          <div style={{ marginTop: 8 }}>
            <div className="row">
              <span className="muted">Effective:</span>
              {lookup.data.effective ? (
                <span className="badge">{lookup.data.effective}</span>
              ) : (
                <span className="muted">none</span>
              )}
            </div>
            {lookup.data.records.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>
                No classification records.
              </p>
            ) : (
              <table style={{ width: "100%", marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Field</th>
                    <th style={{ textAlign: "left" }}>Classification</th>
                    <th style={{ textAlign: "left" }}>Source</th>
                    <th style={{ textAlign: "left" }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {lookup.data.records.map((r) => (
                    <tr key={r.id}>
                      <td className="muted">{r.fieldPath ?? "(object)"}</td>
                      <td>
                        <span className="badge">{r.classification}</span>
                      </td>
                      <td className="muted">{r.source ?? "—"}</td>
                      <td className="muted">
                        {r.confidence === undefined ? "—" : r.confidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
