"use client";

// Phase 9 — credential REFERENCE input. This field captures the *name* of an
// environment variable or secret-manager key that resolves the real secret on
// the server. It is intentionally a plain text input, NOT a password field, and
// it never round-trips an actual secret value.

interface CredentialRefInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function CredentialRefInput({ value, onChange, id = "credentialRef" }: CredentialRefInputProps) {
  return (
    <div className="field">
      <label htmlFor={id}>Credential reference name</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder="e.g. SLACK_BOT_TOKEN or secret://prod/slack"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="muted" style={{ marginTop: 4 }}>
        Enter the NAME of an env var or secret-manager key — never the secret value
        itself. The server resolves the actual credential at runtime.
      </p>
    </div>
  );
}
