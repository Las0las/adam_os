"use client";

// Phase 10 — access control client root. Three tools in one surface: set an ACL
// entry (POST acl), look up ACL entries for an object (GET acl list), and run an
// access check (POST check) showing allowed/denied + reason.

import { useCallback, useState } from "react";
import { useObjectAcls } from "@/components/lawrence/hooks/useObjectAcls";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type {
  AccessDecision,
  AclEffect,
  AclPermission,
  AclPrincipalType,
} from "@/components/lawrence/hooks/securityTypes";

const PRINCIPAL_TYPES: AclPrincipalType[] = ["user", "group", "role"];
const PERMISSIONS: AclPermission[] = ["read", "write", "approve", "execute", "admin"];
const EFFECTS: AclEffect[] = ["allow", "deny"];

export function AccessControlPage() {
  const acls = useObjectAcls();
  const noop = useCallback(() => {}, []);
  const actions = useSecurityActions(noop);

  // Set ACL form state.
  const [aObjectType, setAObjectType] = useState("");
  const [aObjectId, setAObjectId] = useState("");
  const [principalType, setPrincipalType] = useState<AclPrincipalType>("user");
  const [principalId, setPrincipalId] = useState("");
  const [permission, setPermission] = useState<AclPermission>("read");
  const [effect, setEffect] = useState<AclEffect>("allow");
  const [setMsg, setSetMsg] = useState<string | null>(null);

  // Lookup form state.
  const [lObjectType, setLObjectType] = useState("");
  const [lObjectId, setLObjectId] = useState("");

  // Access check state.
  const [cObjectType, setCObjectType] = useState("");
  const [cObjectId, setCObjectId] = useState("");
  const [cPermission, setCPermission] = useState<AclPermission>("read");
  const [decision, setDecision] = useState<AccessDecision | null>(null);
  const [checkErr, setCheckErr] = useState<string | null>(null);

  const submitAcl = async () => {
    setSetMsg(null);
    const res = await actions.post("/api/security/access/acl", {
      objectType: aObjectType.trim(),
      objectId: aObjectId.trim(),
      principalType,
      principalId: principalId.trim(),
      permission,
      effect,
    });
    setSetMsg(res.ok ? "ACL entry saved." : res.error ?? "Failed to save ACL.");
  };

  const submitLookup = () => {
    if (!lObjectType.trim() || !lObjectId.trim()) return;
    acls.load(lObjectType.trim(), lObjectId.trim());
  };

  const submitCheck = async () => {
    setCheckErr(null);
    setDecision(null);
    const res = await actions.post<AccessDecision>("/api/security/access/check", {
      objectType: cObjectType.trim(),
      objectId: cObjectId.trim(),
      permission: cPermission,
    });
    if (res.ok && res.data) setDecision(res.data);
    else setCheckErr(res.error ?? "Access check failed.");
  };

  return (
    <>
      <PageHeader
        title="Access control"
        sub="Manage object ACL entries and evaluate access decisions."
      />

      <div className="card">
        <strong>Set ACL entry</strong>
        <label className="kv">
          <span className="muted">Object type</span>
          <input value={aObjectType} onChange={(e) => setAObjectType(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Object id</span>
          <input value={aObjectId} onChange={(e) => setAObjectId(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Principal type</span>
          <select
            value={principalType}
            onChange={(e) => setPrincipalType(e.target.value as AclPrincipalType)}
          >
            {PRINCIPAL_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="kv">
          <span className="muted">Principal id</span>
          <input value={principalId} onChange={(e) => setPrincipalId(e.target.value)} />
        </label>
        <label className="kv">
          <span className="muted">Permission</span>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as AclPermission)}
          >
            {PERMISSIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="kv">
          <span className="muted">Effect</span>
          <select value={effect} onChange={(e) => setEffect(e.target.value as AclEffect)}>
            {EFFECTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={
              actions.pending ||
              !aObjectType.trim() ||
              !aObjectId.trim() ||
              !principalId.trim()
            }
            onClick={submitAcl}
          >
            Save ACL
          </button>
        </div>
        {setMsg ? (
          <p className="badge" style={{ marginTop: 8 }}>
            {setMsg}
          </p>
        ) : null}
      </div>

      <div className="card">
        <strong>Look up ACL entries</strong>
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
            disabled={acls.loading || !lObjectType.trim() || !lObjectId.trim()}
            onClick={submitLookup}
          >
            Look up
          </button>
        </div>
        {acls.error ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {acls.error}
          </p>
        ) : null}
        {acls.data ? (
          acls.data.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No ACL entries for this object.
            </p>
          ) : (
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Principal</th>
                  <th style={{ textAlign: "left" }}>Permission</th>
                  <th style={{ textAlign: "left" }}>Effect</th>
                </tr>
              </thead>
              <tbody>
                {acls.data.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {entry.principalType}:{entry.principalId}
                    </td>
                    <td>{entry.permission}</td>
                    <td>
                      <span className={`badge ${entry.effect === "deny" ? "bad" : "good"}`}>
                        {entry.effect}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      <div className="card">
        <strong>Access check</strong>
        <div className="btn-row">
          <input
            placeholder="object type"
            value={cObjectType}
            onChange={(e) => setCObjectType(e.target.value)}
          />
          <input
            placeholder="object id"
            value={cObjectId}
            onChange={(e) => setCObjectId(e.target.value)}
          />
          <select
            value={cPermission}
            onChange={(e) => setCPermission(e.target.value as AclPermission)}
          >
            {PERMISSIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={actions.pending || !cObjectType.trim() || !cObjectId.trim()}
            onClick={submitCheck}
          >
            Check access
          </button>
        </div>
        {checkErr ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {checkErr}
          </p>
        ) : null}
        {decision ? (
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${decision.allowed ? "good" : "bad"}`}>
              {decision.allowed ? "Allowed" : "Denied"}
            </span>
            <p className="muted" style={{ marginTop: 8 }}>
              Effect: {decision.effect} — {decision.reason}
            </p>
            {decision.redactions ? (
              <pre style={{ fontSize: 12 }}>
                Redactions: {JSON.stringify(decision.redactions, null, 2)}
              </pre>
            ) : null}
            {decision.requiredApproval ? (
              <pre style={{ fontSize: 12 }}>
                Required approval: {JSON.stringify(decision.requiredApproval, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
