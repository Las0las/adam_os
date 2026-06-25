"use client";

import type { CommandDomain, CommandSeverity } from "@/lib/domains/command-center/command-center-types";
import { domainLabel, severityLabel } from "@/lib/domains/command-center/command-center-formatters";

const DOMAINS: CommandDomain[] = [
  "recruiting",
  "onboarding",
  "support",
  "claims",
  "executive",
  "mission_control",
];

const SEVERITIES: CommandSeverity[] = ["low", "medium", "high", "critical"];

export interface CommandFilterValue {
  domain: CommandDomain | "all";
  severity: CommandSeverity | "all";
}

export function CommandFilters({
  value,
  onChange,
}: {
  value: CommandFilterValue;
  onChange: (next: CommandFilterValue) => void;
}) {
  return (
    <>
      <select
        value={value.domain}
        onChange={(e) =>
          onChange({ ...value, domain: e.target.value as CommandFilterValue["domain"] })
        }
        aria-label="Filter by domain"
      >
        <option value="all">All domains</option>
        {DOMAINS.map((d) => (
          <option key={d} value={d}>
            {domainLabel(d)}
          </option>
        ))}
      </select>

      <select
        value={value.severity}
        onChange={(e) =>
          onChange({ ...value, severity: e.target.value as CommandFilterValue["severity"] })
        }
        aria-label="Filter by severity"
      >
        <option value="all">All severities</option>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {severityLabel(s)}
          </option>
        ))}
      </select>
    </>
  );
}
