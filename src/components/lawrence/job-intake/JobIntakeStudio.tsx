"use client";

/* ============================================================================
   Job Intake Studio — the FIRST implementation of LDS-001.
   A governed, progressively-structured intake that assembles a canonical Job
   requisition object. Built entirely from LDS primitives; zero bespoke page
   styling. External signal (market data) enters only as labeled Evidence and
   Advisor suggestions — it never silently writes the object.
   ========================================================================== */
import { useMemo, useState } from "react";
import {
  EnterpriseShell, Topbar, CommandTrigger, Workspace, WorkspaceHead, WorkspaceGrid, Col,
  Card, PropertyRow, EmptyValue, Kpi, KpiRow, Chip, ChipRow, Badge, Button, Steps,
  Field, Input, Textarea, Select, AdvisorRail, AdvisorItem, Inspector, Timeline, TimelineItem,
  EvidencePanel, EvidenceItem, Diagnostics, DiagnosticRow, type NavGroup,
} from "@/components/lds";
import { CommandCenter, useCommandCenter, type CommandItem } from "@/components/lds/command-center";

const STEPS = [
  { id: "basics", label: "Role Basics" },
  { id: "requirements", label: "Requirements" },
  { id: "compensation", label: "Compensation" },
  { id: "governance", label: "Governance" },
  { id: "review", label: "Review" },
];

// Deterministic per-title skill suggestions (no model call — labeled as advisory).
const SKILL_LIBRARY: Record<string, string[]> = {
  default: ["Communication", "Stakeholder Management", "Problem Solving"],
  engineer: ["TypeScript", "React", "Node.js", "System Design", "AWS", "PostgreSQL"],
  data: ["SQL", "Python", "dbt", "Snowflake", "Statistics", "Experimentation"],
  product: ["Roadmapping", "Discovery", "Analytics", "Prioritization", "Stakeholder Management"],
  designer: ["Figma", "Prototyping", "Design Systems", "User Research", "Accessibility"],
};

function libraryFor(title: string): string[] {
  const t = title.toLowerCase();
  if (/engineer|developer|swe/.test(t)) return SKILL_LIBRARY.engineer;
  if (/data|analyst|ml|ai/.test(t)) return SKILL_LIBRARY.data;
  if (/product manager|\bpm\b|product/.test(t)) return SKILL_LIBRARY.product;
  if (/design/.test(t)) return SKILL_LIBRARY.designer;
  return SKILL_LIBRARY.default;
}

interface Activity { id: number; tone: "good" | "accent" | "info" | "neutral"; title: string; meta?: string; }

export function JobIntakeStudio() {
  const { open, setOpen } = useCommandCenter();
  const [step, setStep] = useState(0);
  const [inspectorTab, setInspectorTab] = useState("object");

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employment, setEmployment] = useState("Full-time");
  const [seniority, setSeniority] = useState("Mid");
  const [summary, setSummary] = useState("");
  const [mustHave, setMustHave] = useState<string[]>([]);
  const [niceToHave, setNiceToHave] = useState<string[]>([]);
  const [minComp, setMinComp] = useState("");
  const [maxComp, setMaxComp] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [approver, setApprover] = useState("");
  const [justification, setJustification] = useState("");

  const [activity, setActivity] = useState<Activity[]>([
    { id: 0, tone: "neutral", title: "Intake session opened", meta: "Draft requisition · unsaved" },
  ]);
  const [opened, setOpened] = useState(false);
  const log = (tone: Activity["tone"], title: string, meta?: string) =>
    setActivity((a) => [{ id: a.length, tone, title, meta }, ...a]);

  const suggestions = useMemo(() => libraryFor(title).filter((s) => !mustHave.includes(s) && !niceToHave.includes(s)), [title, mustHave, niceToHave]);
  const doneIds = useMemo(() => {
    const d: string[] = [];
    if (title && department && location) d.push("basics");
    if (summary && mustHave.length > 0) d.push("requirements");
    if (minComp && maxComp) d.push("compensation");
    if (approver && justification) d.push("governance");
    return d;
  }, [title, department, location, summary, mustHave, minComp, maxComp, approver, justification]);

  // Diagnostics / readiness gate — the requisition cannot open until clean.
  const diagnostics = useMemo(() => {
    const compOk = minComp && maxComp && Number(minComp) <= Number(maxComp);
    return [
      { id: "title", ok: !!title, label: "Role title captured", detail: title || "Required — name the role." },
      { id: "org", ok: !!(department && location), label: "Org placement resolved", detail: department && location ? `${department} · ${location}` : "Department and location required." },
      { id: "skills", ok: mustHave.length >= 1, label: "At least one must-have skill", detail: mustHave.length ? `${mustHave.length} captured` : "Add the non-negotiable skills." },
      { id: "comp", ok: !!compOk, label: "Compensation band valid", detail: compOk ? `${minComp}–${maxComp}` : "Min must be ≤ max and both set." },
      { id: "gov", ok: !!(approver && justification), label: "Governance approver + justification", detail: approver ? `Approver: ${approver}` : "Required for sign-off." },
    ];
  }, [title, department, location, mustHave, minComp, maxComp, approver, justification]);
  const blocking = diagnostics.filter((d) => !d.ok).length;
  const readyPct = Math.round(((diagnostics.length - blocking) / diagnostics.length) * 100);

  const addSkill = (skill: string, bucket: "must" | "nice") => {
    if (bucket === "must") setMustHave((m) => (m.includes(skill) ? m : [...m, skill]));
    else setNiceToHave((m) => (m.includes(skill) ? m : [...m, skill]));
    log("accent", `Skill captured: ${skill}`, bucket === "must" ? "Must-have" : "Nice-to-have");
  };

  const navGroups: NavGroup[] = [
    { title: "Intake", items: [
      { id: "new", label: "New Requisition", active: true },
      { id: "drafts", label: "Drafts", count: 3 },
      { id: "templates", label: "Role Templates", count: 12 },
    ]},
    { title: "Pipeline", items: [
      { id: "open", label: "Open Requisitions", count: 7 },
      { id: "approvals", label: "Approvals", count: 2 },
    ]},
    { title: "System", items: [
      { id: "ds", label: "Design System" },
      { id: "audit", label: "Audit Log" },
    ]},
  ];

  const commands: CommandItem[] = [
    ...STEPS.map((s, i) => ({ id: `goto-${s.id}`, group: "Navigate", label: `Go to ${s.label}`, run: () => setStep(i) })),
    ...suggestions.slice(0, 5).map((s) => ({ id: `add-${s}`, group: "Add must-have skill", label: s, run: () => { addSkill(s, "must"); setStep(1); } })),
    { id: "submit", group: "Actions", label: "Open Requisition", shortcut: "⏎", run: () => openRequisition() },
  ];

  function openRequisition() {
    if (blocking > 0) { log("info", "Open blocked by diagnostics", `${blocking} item(s) unresolved`); setStep(4); return; }
    setOpened(true);
    log("good", "Requisition opened", `${title} · ${headcount} headcount`);
  }

  return (
    <EnterpriseShell
      brand={{ mark: "A", name: "Aberdeen", sub: "LAWRENCE · LDS-001" }}
      groups={navGroups}
      footer={<span>Job Intake Studio · v1</span>}
    >
      <Topbar crumbs={["Intake", "New Requisition", title || "Untitled role"]}>
        <CommandTrigger onClick={() => setOpen(true)} />
      </Topbar>

      <Workspace>
        <WorkspaceHead title="Job Intake Studio" desc="Progressively structure a hiring requisition into a canonical Job object. Advisor suggestions and market signal enter as evidence — you decide what gets captured.">
          <div className="lds-row" style={{ gap: 8 }}>
            <Badge tone={opened ? "good" : blocking ? "warn" : "brand"}>{opened ? "OPENED" : blocking ? `${blocking} TO RESOLVE` : "READY"}</Badge>
            <Button variant="accent" onClick={openRequisition} disabled={opened}>{opened ? "Requisition Open" : "Open Requisition"}</Button>
          </div>
        </WorkspaceHead>

        <KpiRow>
          <Kpi value={`${readyPct}%`} label="Readiness" accent sub={`${diagnostics.length - blocking}/${diagnostics.length} checks pass`} />
          <Kpi value={mustHave.length + niceToHave.length} label="Skills captured" sub={`${mustHave.length} must · ${niceToHave.length} nice`} />
          <Kpi value={headcount || "—"} label="Headcount" sub={employment} />
          <Kpi value={minComp && maxComp ? `${minComp}–${maxComp}` : "—"} label="Comp band" sub="USD / year" />
        </KpiRow>

        <Card label="Progressive structured input"><Steps steps={STEPS} currentIndex={step} doneIds={doneIds} /></Card>

        <WorkspaceGrid>
          <Col>
            {step === 0 && (
              <Card title="Role Basics" actions={<StepNav step={step} setStep={setStep} />}>
                <Field label="Role title" required done={!!title} hint="Drives advisor skill suggestions and market comparables.">
                  <Input value={title} placeholder="e.g. Senior Software Engineer" onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field label="Department" required done={!!department}>
                  <Input value={department} placeholder="e.g. Platform Engineering" onChange={(e) => setDepartment(e.target.value)} />
                </Field>
                <Field label="Location" required done={!!location}>
                  <Input value={location} placeholder="e.g. Remote (US) / New York, NY" onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Employment type" done>
                  <Select value={employment} onChange={(e) => setEmployment(e.target.value)}>
                    {["Full-time", "Part-time", "Contract", "Internship"].map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
                <Field label="Seniority" done>
                  <Select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                    {["Junior", "Mid", "Senior", "Staff", "Principal", "Lead"].map((o) => <option key={o}>{o}</option>)}
                  </Select>
                </Field>
              </Card>
            )}

            {step === 1 && (
              <>
                <Card title="Requirements" actions={<StepNav step={step} setStep={setStep} />}>
                  <Field label="Role summary" required done={!!summary} hint="One paragraph describing the mission of the role.">
                    <Textarea value={summary} placeholder="Own the reliability and scale of the core platform…" onChange={(e) => setSummary(e.target.value)} />
                  </Field>
                  <Field label="Must-have skills" required done={mustHave.length > 0} hint="Non-negotiable. These become hard filters in sourcing.">
                    <ChipRow>
                      {mustHave.map((s) => <Chip key={s} state="resolved" onRemove={() => setMustHave((m) => m.filter((x) => x !== s))}>{s}</Chip>)}
                      {mustHave.length === 0 ? <span className="lds-empty-note">No must-have skills yet — add from suggestions.</span> : null}
                    </ChipRow>
                  </Field>
                  <Field label="Nice-to-have skills" done={niceToHave.length > 0}>
                    <ChipRow>
                      {niceToHave.map((s) => <Chip key={s} state="suggested" onRemove={() => setNiceToHave((m) => m.filter((x) => x !== s))}>{s}</Chip>)}
                      {niceToHave.length === 0 ? <span className="lds-empty-note">Optional differentiators.</span> : null}
                    </ChipRow>
                  </Field>
                </Card>
                <Card title="Suggested skills" label={`From "${title || "role"}" library`}>
                  <ChipRow>
                    {suggestions.length === 0 ? <span className="lds-empty-note">Enter a role title to surface suggestions.</span> :
                      suggestions.map((s) => (
                        <span key={s} className="lds-row" style={{ gap: 4 }}>
                          <Chip state="pending">{s}</Chip>
                          <Button size="sm" variant="quiet" onClick={() => addSkill(s, "must")}>+ must</Button>
                          <Button size="sm" variant="quiet" onClick={() => addSkill(s, "nice")}>+ nice</Button>
                        </span>
                      ))}
                  </ChipRow>
                </Card>
              </>
            )}

            {step === 2 && (
              <Card title="Compensation" actions={<StepNav step={step} setStep={setStep} />}>
                <Field label="Minimum (USD/yr)" required done={!!minComp}>
                  <Input value={minComp} inputMode="numeric" placeholder="140000" onChange={(e) => setMinComp(e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
                <Field label="Maximum (USD/yr)" required done={!!maxComp} hint="Must be greater than or equal to the minimum.">
                  <Input value={maxComp} inputMode="numeric" placeholder="185000" onChange={(e) => setMaxComp(e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
                <Field label="Headcount" done>
                  <Input value={headcount} inputMode="numeric" onChange={(e) => setHeadcount(e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
              </Card>
            )}

            {step === 3 && (
              <Card title="Governance" actions={<StepNav step={step} setStep={setStep} />}>
                <Field label="Hiring manager / approver" required done={!!approver} hint="The accountable signer for this requisition.">
                  <Input value={approver} placeholder="e.g. Reinia Hall" onChange={(e) => setApprover(e.target.value)} />
                </Field>
                <Field label="Business justification" required done={!!justification}>
                  <Textarea value={justification} placeholder="Backfill for attrition / growth-driven net-new headcount…" onChange={(e) => setJustification(e.target.value)} />
                </Field>
              </Card>
            )}

            {step === 4 && (
              <Card title="Canonical Job object" label="Review" actions={<StepNav step={step} setStep={setStep} />}>
                <PropertyRow k="Title">{title || <EmptyValue />}</PropertyRow>
                <PropertyRow k="Org">{department && location ? `${department} · ${location}` : <EmptyValue />}</PropertyRow>
                <PropertyRow k="Type / Seniority">{employment} · {seniority}</PropertyRow>
                <PropertyRow k="Summary">{summary || <EmptyValue />}</PropertyRow>
                <PropertyRow k="Must-have">{mustHave.length ? <ChipRow>{mustHave.map((s) => <Chip key={s} state="resolved">{s}</Chip>)}</ChipRow> : <EmptyValue />}</PropertyRow>
                <PropertyRow k="Nice-to-have">{niceToHave.length ? <ChipRow>{niceToHave.map((s) => <Chip key={s} state="suggested">{s}</Chip>)}</ChipRow> : <EmptyValue />}</PropertyRow>
                <PropertyRow k="Compensation">{minComp && maxComp ? `$${minComp}–$${maxComp} · ${headcount} headcount` : <EmptyValue />}</PropertyRow>
                <PropertyRow k="Approver">{approver || <EmptyValue />}</PropertyRow>
              </Card>
            )}
          </Col>

          <Col>
            <Inspector
              title="Inspector"
              tabs={[{ id: "object", label: "Object" }, { id: "advisor", label: "Advisor" }, { id: "diagnostics", label: "Diagnostics" }, { id: "activity", label: "Activity" }]}
              active={inspectorTab}
              onTab={setInspectorTab}
            >
              {inspectorTab === "object" && (
                <>
                  <PropertyRow k="Type">Job</PropertyRow>
                  <PropertyRow k="Status">{opened ? <Badge tone="good">OPEN</Badge> : <Badge tone="neutral">DRAFT</Badge>}</PropertyRow>
                  <PropertyRow k="Title">{title || <EmptyValue />}</PropertyRow>
                  <PropertyRow k="Skills">{mustHave.length + niceToHave.length}</PropertyRow>
                  <PropertyRow k="Readiness">{readyPct}%</PropertyRow>
                </>
              )}
              {inspectorTab === "advisor" && (
                <AdvisorRail>
                  <AdvisorItem tone="advise" title="Most likely next" confidence="92%">
                    {step < 4 ? `Complete ${STEPS[step].label}, then move to ${STEPS[step + 1]?.label}.` : "Resolve diagnostics, then open the requisition."}
                  </AdvisorItem>
                  {title ? (
                    <AdvisorItem tone="suggest" title="Skill suggestions ready" confidence="market" actions={<Button size="sm" variant="ghost" onClick={() => setStep(1)}>Review skills</Button>}>
                      {suggestions.length} skills inferred from the "{title}" role family.
                    </AdvisorItem>
                  ) : null}
                  {minComp && maxComp && Number(minComp) > Number(maxComp) ? (
                    <AdvisorItem tone="warn" title="Compensation inverted">Minimum exceeds maximum — adjust the band.</AdvisorItem>
                  ) : (
                    <AdvisorItem tone="suggest" title="Market comparable" confidence="advisory">
                      Similar roles trend $150k–$190k. This is advisory signal, not a captured value.
                    </AdvisorItem>
                  )}
                </AdvisorRail>
              )}
              {inspectorTab === "diagnostics" && (
                <Diagnostics>
                  {diagnostics.map((d) => (
                    <DiagnosticRow key={d.id} tone={d.ok ? "good" : "warn"} label={d.label} detail={d.detail} badge={<Badge tone={d.ok ? "good" : "warn"}>{d.ok ? "PASS" : "OPEN"}</Badge>} />
                  ))}
                </Diagnostics>
              )}
              {inspectorTab === "activity" && (
                <Timeline>
                  {activity.map((a) => <TimelineItem key={a.id} tone={a.tone} title={a.title} meta={a.meta} />)}
                </Timeline>
              )}
            </Inspector>

            <Card title="Evidence" label="Advisory signal">
              <EvidencePanel>
                <EvidenceItem title="Role family match" source="lib:roles" provenance="deterministic · not a live feed">
                  Title mapped to {suggestions.length + mustHave.length} candidate skills.
                </EvidenceItem>
                <EvidenceItem title="Comp comparable" source="advisory" provenance="illustrative · verify before publishing">
                  Market band for {seniority} {title || "role"}: $150k–$190k.
                </EvidenceItem>
              </EvidencePanel>
            </Card>
          </Col>
        </WorkspaceGrid>
      </Workspace>

      <CommandCenter open={open} onClose={() => setOpen(false)} items={commands} />
    </EnterpriseShell>
  );
}

function StepNav({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <div className="lds-row" style={{ gap: 6 }}>
      <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</Button>
      <Button size="sm" variant="primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next →</Button>
    </div>
  );
}
