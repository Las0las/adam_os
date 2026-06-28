import {
  EnterpriseShell, Topbar, Workspace, WorkspaceHead, WorkspaceGrid, Col, Card, PropertyRow,
  Kpi, KpiRow, Chip, ChipRow, Badge, Button, Steps, Field, Input, AdvisorRail, AdvisorItem,
  Inspector, Timeline, TimelineItem, EvidencePanel, EvidenceItem, Diagnostics, DiagnosticRow,
  SectionLabel, type NavGroup,
} from "@/components/lds";

export const metadata = {
  title: "LDS-001 — LAWRENCE Design System",
  description: "The canonical Aberdeen visual foundation for every LAWRENCE artifact.",
};

const PRIMARY = [
  { name: "Aberdeen Blue", hex: "#09375F", ink: "#fff", role: "Primary · navigation, emphasis" },
  { name: "Verdigris", hex: "#44B0B1", ink: "#06403f", role: "Accent · interaction states" },
  { name: "White", hex: "#FFFFFF", ink: "#404040", role: "Surface" },
  { name: "Onyx", hex: "#404040", ink: "#fff", role: "Body text" },
];
const SECONDARY = [
  { name: "Deep Sky Blue", hex: "#5CC8FF", ink: "#09375F", role: "Info" },
  { name: "Jade", hex: "#00A676", ink: "#fff", role: "Success" },
  { name: "Gold", hex: "#F7D002", ink: "#404040", role: "Warning" },
  { name: "Jasper", hex: "#DB504A", ink: "#fff", role: "Danger" },
];

function Swatch({ name, hex, ink, role }: { name: string; hex: string; ink: string; role: string }) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--lds-border)" }}>
      <div style={{ background: hex, color: ink, padding: "20px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
        <span style={{ fontFamily: "var(--lds-mono)", fontSize: 11, opacity: 0.85 }}>{hex}</span>
      </div>
      <div style={{ padding: "8px 12px", fontSize: 11.5, color: "var(--lds-muted)", background: "var(--lds-surface)" }}>{role}</div>
    </div>
  );
}

const navGroups: NavGroup[] = [
  { title: "Foundation", items: [
    { id: "color", label: "Color", active: true },
    { id: "type", label: "Typography" },
    { id: "components", label: "Components" },
  ]},
  { title: "Studios", items: [
    { id: "intake", label: "Job Intake Studio" },
  ]},
];

export default function DesignSystemPage() {
  return (
    <EnterpriseShell brand={{ mark: "A", name: "Aberdeen", sub: "LDS-001" }} groups={navGroups} footer={<span>Design System · v1.02</span>}>
      <Topbar crumbs={["Foundation", "LAWRENCE Design System"]} />
      <Workspace>
        <WorkspaceHead title="LDS-001 — LAWRENCE Design System" desc="The canonical Aberdeen visual foundation. Every Studio, Blueprint, and prototype inherits this system — modern, executive, technical. Client-branded experiences are the only sanctioned exception.">
          <Badge tone="brand">PLATFORM STANDARD</Badge>
        </WorkspaceHead>

        <Card title="Primary palette" label="Color · brand">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {PRIMARY.map((c) => <Swatch key={c.name} {...c} />)}
          </div>
        </Card>

        <Card title="Secondary palette" label="Color · status & charts">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {SECONDARY.map((c) => <Swatch key={c.name} {...c} />)}
          </div>
        </Card>

        <Card title="Typography" label="Poppins · Arial fallback">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><SectionLabel>Heading · 600</SectionLabel><div style={{ fontSize: 30, fontWeight: 600, color: "var(--lds-ink)", letterSpacing: "-0.01em" }}>The quick brown fox</div></div>
            <div><SectionLabel>Subheading · 500</SectionLabel><div style={{ fontSize: 19, fontWeight: 500, color: "var(--lds-ink)" }}>The quick brown fox jumps over the lazy dog</div></div>
            <div><SectionLabel>Body · 400</SectionLabel><div style={{ fontSize: 14, color: "var(--lds-body)" }}>The quick brown fox jumps over the lazy dog. 1234567890</div></div>
            <div><SectionLabel>Mono label</SectionLabel><div className="lds-mono" style={{ fontSize: 12, color: "var(--lds-muted)" }}>SECTION.LABEL · METADATA · KEYS</div></div>
          </div>
        </Card>

        <WorkspaceGrid>
          <Col>
            <Card title="Buttons & chips" label="Components">
              <div className="lds-row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <Button variant="primary">Primary</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="quiet">Quiet</Button>
              </div>
              <ChipRow>
                <Chip state="resolved">Resolved</Chip>
                <Chip state="suggested">Suggested</Chip>
                <Chip state="pending">Pending</Chip>
                <Chip state="conflict">Conflict</Chip>
              </ChipRow>
              <div className="lds-row" style={{ gap: 8, marginTop: 14 }}>
                <Badge tone="good">GOOD</Badge><Badge tone="warn">WARN</Badge><Badge tone="bad">BAD</Badge><Badge tone="info">INFO</Badge><Badge tone="brand">BRAND</Badge>
              </div>
            </Card>

            <Card title="Property card" label="Components">
              <PropertyRow k="Object type">Job</PropertyRow>
              <PropertyRow k="Status"><Badge tone="good">OPEN</Badge></PropertyRow>
              <PropertyRow k="Skills"><ChipRow><Chip state="resolved">TypeScript</Chip><Chip state="resolved">React</Chip></ChipRow></PropertyRow>
            </Card>

            <Card title="Progressive input" label="Components">
              <Steps steps={[{ id: "a", label: "Basics" }, { id: "b", label: "Detail" }, { id: "c", label: "Review" }]} currentIndex={1} doneIds={["a"]} />
              <div style={{ marginTop: 8 }}>
                <Field label="Role title" required done hint="Drives advisor suggestions."><Input defaultValue="Senior Software Engineer" /></Field>
              </div>
            </Card>

            <Card title="KPIs" label="Components"><KpiRow>
              <Kpi value="100%" label="Readiness" accent sub="5/5 checks" />
              <Kpi value="6" label="Skills" sub="4 must · 2 nice" />
            </KpiRow></Card>
          </Col>

          <Col>
            <Inspector title="Inspector" tabs={[{ id: "a", label: "Advisor" }]} active="a">
              <AdvisorRail>
                <AdvisorItem tone="advise" title="Most likely next" confidence="92%">Complete Requirements, then Compensation.</AdvisorItem>
                <AdvisorItem tone="suggest" title="Market comparable" confidence="advisory">Similar roles trend $150k–$190k.</AdvisorItem>
              </AdvisorRail>
            </Inspector>

            <Card title="Activity timeline" label="Components">
              <Timeline>
                <TimelineItem tone="good" title="Requisition opened" meta="Senior SWE · 1 headcount" ts="just now" />
                <TimelineItem tone="accent" title="Skill captured: React" meta="Must-have" />
                <TimelineItem tone="neutral" title="Intake session opened" meta="Draft" />
              </Timeline>
            </Card>

            <Card title="Diagnostics" label="Components">
              <Diagnostics>
                <DiagnosticRow tone="good" label="Role title captured" detail="Senior Software Engineer" badge={<Badge tone="good">PASS</Badge>} />
                <DiagnosticRow tone="warn" label="Compensation band valid" detail="Min must be ≤ max" badge={<Badge tone="warn">OPEN</Badge>} />
              </Diagnostics>
            </Card>

            <Card title="Evidence" label="Components">
              <EvidencePanel>
                <EvidenceItem title="Role family match" source="lib:roles" provenance="deterministic · not a live feed">Title mapped to 6 candidate skills.</EvidenceItem>
              </EvidencePanel>
            </Card>
          </Col>
        </WorkspaceGrid>
      </Workspace>
    </EnterpriseShell>
  );
}
