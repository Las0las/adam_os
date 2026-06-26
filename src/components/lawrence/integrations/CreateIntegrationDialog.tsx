"use client";

// Phase 9 — create integration connection form (rendered as a page form). Captures
// key, name, provider, credential REFERENCE name, and an optional config JSON
// blob. Submit is blocked until key/name/provider are present and any config
// JSON parses. On success it navigates to the new connection's detail page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationProvider } from "@/lib/integrations/integration-types";
import { useIntegrationActions } from "@/components/lawrence/hooks/useIntegrationActions";
import { CredentialRefInput } from "./CredentialRefInput";

const PROVIDERS: IntegrationProvider[] = [
  "microsoft365",
  "google_workspace",
  "slack",
  "sharepoint",
  "one_drive",
  "greenhouse",
  "lever",
  "gusto",
  "custom_api",
  "webhook",
];

export function CreateIntegrationDialog() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<IntegrationProvider | "">("");
  const [credentialRef, setCredentialRef] = useState("");
  const [configText, setConfigText] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);

  // Mutations refetch nothing here; we navigate on success instead.
  const { pending, error, create } = useIntegrationActions(() => {});

  const canSubmit =
    key.trim().length > 0 && name.trim().length > 0 && provider !== "" && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (provider === "" || !canSubmit) return;

    let config: Record<string, unknown> | undefined;
    if (configText.trim().length > 0) {
      try {
        const parsed = JSON.parse(configText) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setConfigError("Config must be a JSON object.");
          return;
        }
        config = parsed as Record<string, unknown>;
      } catch {
        setConfigError("Config is not valid JSON.");
        return;
      }
    }
    setConfigError(null);

    const res = await create({
      key: key.trim(),
      name: name.trim(),
      provider,
      credentialRef: credentialRef.trim() || undefined,
      config,
    });

    if (res.ok && res.data) {
      router.push(`/settings/integrations/${res.data.id}`);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="key">Connection key</label>
        <input
          id="key"
          type="text"
          value={key}
          autoComplete="off"
          placeholder="e.g. slack-prod"
          onChange={(e) => setKey(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          autoComplete="off"
          placeholder="e.g. Slack (Production)"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="provider">Provider</label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as IntegrationProvider | "")}
        >
          <option value="">Select a provider…</option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <CredentialRefInput value={credentialRef} onChange={setCredentialRef} />

      <div className="field">
        <label htmlFor="config">Config (JSON, optional)</label>
        <textarea
          id="config"
          rows={4}
          value={configText}
          spellCheck={false}
          placeholder='{ "baseUrl": "https://..." }'
          onChange={(e) => setConfigText(e.target.value)}
        />
        {configError ? <p className="badge bad">{configError}</p> : null}
        <p className="muted" style={{ marginTop: 4 }}>
          Non-secret configuration only. Secrets belong in the credential
          reference above.
        </p>
      </div>

      {error ? <p className="badge bad">{error}</p> : null}

      <div className="btn-row">
        <button type="submit" className="btn" disabled={!canSubmit}>
          {pending ? "Creating…" : "Create connection"}
        </button>
        <a className="btn" href="/settings/integrations">
          Cancel
        </a>
      </div>
    </form>
  );
}
