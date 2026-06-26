"use client";

// Phase 8 — installed-state badge for a domain pack. Green "Installed vX" when
// installed (with optional version), muted "Not installed" otherwise.

export function InstalledPackBadge({
  installed,
  version,
}: {
  installed: boolean;
  version?: string | null;
}) {
  if (installed) {
    return (
      <span className="badge good">
        Installed{version ? ` v${version}` : ""}
      </span>
    );
  }
  return <span className="badge neutral">Not installed</span>;
}
