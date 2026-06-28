// Config-driven navigation for the Lawrence shell (Phase 2 §49). The Sidebar
// renders from this; every entry resolves to a real route in app/(lawrence).

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const lawrenceNav: NavSection[] = [
  {
    title: "Operate",
    items: [
      { label: "Command Center", href: "/" },
      { label: "Action Queue", href: "/command-center/action-queue" },
      { label: "Review Queue", href: "/command-center/review-queue" },
      { label: "Recommendations", href: "/command-center/recommendations" },
      { label: "Alerts", href: "/command-center/alerts" },
      { label: "Activity", href: "/command-center/activity" },
    ],
  },
  {
    title: "Govern",
    items: [
      { label: "Constitution", href: "/constitution" },
      { label: "Kernel Explorer", href: "/kernel" },
      { label: "Architecture Primer", href: "/primer" },
      { label: "Projection Studio", href: "/studio" },
      { label: "Engineering Program", href: "/program" },
    ],
  },
  {
    title: "DataOps",
    items: [
      { label: "Overview", href: "/dataops" },
      { label: "Pipelines", href: "/dataops/pipelines" },
      { label: "Sources", href: "/dataops/sources" },
      { label: "Ontology", href: "/dataops/ontology" },
      { label: "Evidence", href: "/dataops/evidence" },
      { label: "Evidence Search", href: "/dataops/evidence/search" },
    ],
  },
  {
    title: "AIOps",
    items: [
      { label: "Overview", href: "/aiops" },
      { label: "Functions", href: "/aiops/functions" },
      { label: "Agents", href: "/aiops/agents" },
      { label: "Prompts", href: "/aiops/prompts" },
      { label: "Models", href: "/aiops/models" },
      { label: "Evals", href: "/aiops/evals" },
      { label: "Observability", href: "/aiops/observability" },
    ],
  },
  {
    title: "Mission Control",
    items: [
      { label: "Overview", href: "/mission-control" },
      { label: "Deployments", href: "/mission-control/deployments" },
      { label: "Releases", href: "/mission-control/releases" },
      { label: "Approvals", href: "/mission-control/approvals" },
      { label: "Notifications", href: "/mission-control/notifications" },
      { label: "Incidents", href: "/mission-control/incidents" },
      { label: "Runtime Health", href: "/mission-control/runtime/health" },
      { label: "Graph Integrity", href: "/mission-control/graph-integrity" },
      { label: "Audit", href: "/mission-control/runtime/audit" },
    ],
  },
  {
    title: "Security",
    items: [
      { label: "Overview", href: "/security" },
      { label: "Findings", href: "/security/findings" },
      { label: "Access Control", href: "/security/access" },
      { label: "Classifications", href: "/security/classifications" },
      { label: "Retention", href: "/security/retention" },
      { label: "Compliance Exports", href: "/security/compliance" },
      { label: "Audit Integrity", href: "/security/audit-integrity" },
      { label: "Security Harness", href: "/security/harness" },
    ],
  },
  {
    title: "Domain Packs",
    items: [
      { label: "Recruiting", href: "/recruiting" },
      { label: "Onboarding", href: "/onboarding" },
      { label: "Support", href: "/support" },
      { label: "Claims / Validation", href: "/claims" },
      { label: "Executive / Commercial", href: "/executive" },
    ],
  },
];
