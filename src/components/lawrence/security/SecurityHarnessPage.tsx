"use client";

// Phase 10 — security harness client root. Runs the security harness (POST
// harness) rendering each probe with a pass/fail badge, and a secret scan (POST
// secret-scan) showing the masked findings it produced.

import { useCallback, useState } from "react";
import { useSecurityActions } from "@/components/lawrence/hooks/useSecurityActions";
import { PageHeader } from "@/components/lawrence/shared/widgets";
import type {
  HarnessResult,
  SecretScanResult,
} from "@/components/lawrence/hooks/securityTypes";

export function SecurityHarnessPage() {
  const noop = useCallback(() => {}, []);
  const actions = useSecurityActions(noop);

  const [harness, setHarness] = useState<HarnessResult | null>(null);
  const [harnessErr, setHarnessErr] = useState<string | null>(null);

  const [scan, setScan] = useState<SecretScanResult | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const runHarness = async () => {
    setHarnessErr(null);
    setHarness(null);
    const res = await actions.post<HarnessResult>("/api/security/harness", {});
    if (res.ok && res.data) setHarness(res.data);
    else setHarnessErr(res.error ?? "Harness run failed.");
  };

  const runScan = async () => {
    setScanErr(null);
    setScan(null);
    const res = await actions.post<SecretScanResult>("/api/security/secret-scan", {});
    if (res.ok && res.data) setScan(res.data);
    else setScanErr(res.error ?? "Secret scan failed.");
  };

  return (
    <>
      <PageHeader
        title="Security harness"
        sub="Run the security probe harness and scan for leaked secrets."
      />

      <div className="card">
        <div className="row">
          <strong>Security harness</strong>
          <button
            type="button"
            className="btn"
            disabled={actions.pending}
            onClick={runHarness}
          >
            Run security harness
          </button>
        </div>
        {harnessErr ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {harnessErr}
          </p>
        ) : null}
        {harness ? (
          <>
            <div className="row" style={{ marginTop: 8 }}>
              <span className={`badge ${harness.passed ? "good" : "bad"}`}>
                {harness.passed ? "All probes passed" : `${harness.failedCount} failed`}
              </span>
              <span className="muted">{harness.probeCount} probe(s)</span>
            </div>
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: 32 }} aria-label="result" />
                  <th style={{ textAlign: "left" }}>Probe</th>
                  <th style={{ textAlign: "left" }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {harness.probes.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <span
                        className={`badge ${p.passed ? "good" : "bad"}`}
                        aria-label={p.passed ? "passed" : "failed"}
                      >
                        {p.passed ? "✓" : "✕"}
                      </span>
                    </td>
                    <td>{p.label}</td>
                    <td className="muted">{p.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>

      <div className="card">
        <div className="row">
          <strong>Secret scan</strong>
          <button
            type="button"
            className="btn"
            disabled={actions.pending}
            onClick={runScan}
          >
            Scan for secrets
          </button>
        </div>
        {scanErr ? (
          <p className="badge bad" style={{ marginTop: 8 }}>
            {scanErr}
          </p>
        ) : null}
        {scan ? (
          <>
            <div className="row" style={{ marginTop: 8 }}>
              <span className={`badge ${scan.secretsFound > 0 ? "bad" : "good"}`}>
                {scan.secretsFound} secret(s) found
              </span>
              <span className="muted">{scan.scanned} item(s) scanned</span>
            </div>
            {scan.findings.length === 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>
                No secrets detected.
              </p>
            ) : (
              <table style={{ width: "100%", marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Severity</th>
                    <th style={{ textAlign: "left" }}>Title</th>
                    <th style={{ textAlign: "left" }}>Object</th>
                    <th style={{ textAlign: "left" }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.findings.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span
                          className={`badge ${f.severity === "critical" || f.severity === "high" ? "bad" : "warn"}`}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td>{f.title}</td>
                      <td className="muted">
                        {f.objectType ? `${f.objectType}/${f.objectId ?? "—"}` : "—"}
                      </td>
                      <td>
                        <pre
                          style={{
                            maxWidth: 240,
                            maxHeight: 120,
                            overflow: "auto",
                            fontSize: 11,
                            margin: 0,
                          }}
                        >
                          {JSON.stringify(f.evidence, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
