const NAV: Array<{ group: string; links: Array<{ href: string; label: string }> }> = [
  {
    group: "Command",
    links: [
      { href: "/", label: "Command Center" },
      { href: "/command-center/review-queue", label: "Review Queue" },
    ],
  },
  {
    group: "DataOps",
    links: [
      { href: "/dataops", label: "Overview" },
      { href: "/dataops/pipelines", label: "Pipelines" },
      { href: "/dataops/ontology", label: "Ontology" },
      { href: "/dataops/evidence", label: "Evidence" },
    ],
  },
  {
    group: "AIOps",
    links: [
      { href: "/aiops", label: "Overview" },
      { href: "/aiops/functions", label: "Functions" },
      { href: "/aiops/agents", label: "Agents" },
      { href: "/aiops/observability", label: "Observability" },
    ],
  },
  {
    group: "Mission Control",
    links: [
      { href: "/mission-control", label: "Overview" },
      { href: "/mission-control/approvals", label: "Approvals" },
      { href: "/mission-control/runtime/health", label: "Runtime Health" },
      { href: "/mission-control/runtime/audit", label: "Audit" },
    ],
  },
  {
    group: "Domain Packs",
    links: [{ href: "/recruiting", label: "Recruiting" }],
  },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        LAWRENCE
        <small>Enterprise Operating System</small>
      </div>
      {NAV.map((section) => (
        <div className="nav-group" key={section.group}>
          <h4>{section.group}</h4>
          {section.links.map((link) => (
            <a className="nav-link" href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}
