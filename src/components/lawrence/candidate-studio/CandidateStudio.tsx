"use client";

/* ============================================================================
   Candidate Studio — a sibling LDS-001 implementation (after Job Intake Studio).
   Where Job Intake assembles a Job requisition, Candidate Studio RESOLVES a
   canonical Candidate from messy inbound signal (a pasted resume / parsed
   fields) into the registered `candidateObject` shape. It is DRIVEN BY the real
   EnterpriseObjectDefinition: the studio's fields, lifecycle and readiness gate
   are projected from `candidateObject` metadata — not hand-coded — so it can
   never drift from the registered contract. External parsing enters only as
   labeled Evidence + Advisor suggestions; nothing writes the object silently.
   ========================================================================== */
import { useMemo, useState } from "react";
import {
  EnterpriseShell, Topbar, CommandTrigger, Workspace, WorkspaceHead, WorkspaceGrid, Col,
  Card, PropertyRow, EmptyValue, Kpi, KpiRow, Chip, ChipRow, Badge, Button,
  Field, Input, Textarea, Select, AdvisorRail, AdvisorItem, Inspector, Timeline, TimelineItem,
  EvidencePanel, EvidenceItem, Diagnostics, DiagnosticRow, type NavGroup,
} from "@/components/lds";
import { CommandCenter, useCommandCenter, type CommandItem } from "@/components/lds/command-center";
import { candidateObject } from "@/lib/projection-runtime/definitions/candidate.object";

// ---- Project the registered object definition into studio-shaped metadata ----
// (We read the REAL definition so the studio mirrors the contract exactly.)
const FIELDS = candidateObject.fields;
const LIFECYCLE = candidateObject.lifecycle!.states;
const TRANSITIONS = candidateObject.lifecycle!.transitions;
const STATUS_OPTIONS = (FIELDS.find((f) => f.key === "status")?.options ?? []).map((o) => o.value);
// The canonical governance rule: at least one of fullName | email.
const ANY_OF = candidateObject.objectValidations!.find((v) => v.kind === "anyOf")!;

type Draft = { fullName: string; email: string; location: string; summary: string; status: string };
const EMPTY: Draft = { fullName: "", email: "", location: "", summary: "", status: "new" };

// A deterministic "parsed resume" — simulates inbound signal a parser would emit.
// It is NOT applied; each field becomes an Advisor suggestion the operator accepts.
const PARSED = {
  fullName: "Grace Hopper",
  email: "grace.hopper@example.com",
  location: "Arlington, VA",
  summary: "Pioneering computer scientist; compiler design, distributed systems, large-scale program governance.",
  skills: ["Compilers", "Distributed Systems", "COBOL", "Systems Architecture", "Mentorship"],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Activity { id: number; tone: "good" | "accent" | "info" | "neutral" | "warn"; title: string; meta?: string; }

export function CandidateStudio() {
  const { open, setOpen } = useCommandCenter();
  const [tab, setTab] = useState("object");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [skills, setSkills] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]); // which parsed fields were accepted
  const [committed, setCommitted] = useState(false);

  const [activity, setActivity] = useState<Activity[]>([
    { id: 0, tone: "neutral", title: "Resolution session opened", meta: "Unresolved candidate · draft" },
  ]);
  const log = (tone: Activity["tone"], title: string, meta?: string) =>
    setActivity((a) => [{ id: a.length, tone, title, meta }, ...a]);

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  // ---- Diagnostics: projected directly from the object contract ----
  const emailOk = !draft.email || EMAIL_RE.test(draft.email);
  const anyOfOk = !!(draft.fullName.trim() || draft.email.trim());
  const diagnostics = useMemo(() => [
    { id: "anyof", ok: anyOfOk, label: "Identity present", detail: anyOfOk ? "Has full name or email" : ANY_OF.message },
    { id: "email", ok: emailOk, label: "Email well-formed", detail: emailOk ? (draft.email || "No email (optional)") : "Enter a valid email address." },
    { id: "status", ok: STATUS_OPTIONS.includes(draft.status), label: "Stage in domain", detail: `Stage = ${draft.status}` },
    { id: "summary", ok: !!draft.summary.trim(), label: "Summary for retrieval", detail: draft.summary ? "Captured" : "Recommended for matching (non-blocking)." , soft: true },
  ], [anyOfOk, emailOk, draft.email, draft.status, draft.summary]);
  const blocking = diagnostics.filter((d) => !d.ok && !d.soft).length;
  const hardChecks = diagnostics.filter((d) => !d.soft);
  const readyPct = Math.round(((hardChecks.length - hardChecks.filter((d) => !d.ok).length) / hardChecks.length) * 100);

  // ---- Parsed-resume suggestions still pending acceptance ----
  const pendingFields = (["fullName", "email", "location", "summary"] as const)
    .filter((k) => !accepted.includes(k) && PARSED[k] && draft[k] !== PARSED[k]);
  const pendingSkills = PARSED.skills.filter((s) => !skills.includes(s));

  const acceptField = (k: keyof Draft) => {
    set(k, (PARSED as Record<string, string>)[k]);
    setAccepted((a) => (a.includes(k) ? a : [...a, k]));
    log("accent", `Accepted parsed ${k}`, String((PARSED as Record<string, string>)[k]).slice(0, 48));
  };
  const acceptAll = () => {
    setDraft((d) => ({ ...d, fullName: PARSED.fullName, email: PARSED.email, location: PARSED.location, summary: PARSED.summary }));
    setAccepted(["fullName", "email", "location", "summary"]);
    log("accent", "Accepted all parsed identity fields", "4 fields from resume evidence");
  };
  const addSkill = (s: string) => { setSkills((p) => (p.includes(s) ? p : [...p, s])); log("accent", `Skill captured: ${s}`); };

  // ---- Governed transitions available from current stage ----
  const available = TRANSITIONS.filter((t) => t.from === draft.status);

  function applyTransition(to: string, label: string) {
    if (blocking > 0) { log("warn", "Transition blocked by diagnostics", `${blocking} hard check(s) open`); setTab("diagnostics"); return; }
    set("status", to);
    log("good", `Lifecycle: ${label}`, `→ ${to}`);
  }

  function commit() {
    if (blocking > 0) { log("warn", "Resolve blocked", `${blocking} hard check(s) open`); setTab("diagnostics"); return; }
    setCommitted(true);
    log("good", "Candidate resolved", `${draft.fullName || draft.email} · governed create`);
  }

  const navGroups: NavGroup[] = [
    { title: "Resolve", items: [
      { id: "new", label: "New Candidate", active: true },
      { id: "inbox", label: "Parser Inbox", count: 5 },
      { id: "dupes", label: "Possible Duplicates", count: 1 },
    ]},
    { title: "Pipeline", items: [
      { id: "active", label: "Active", count: 18 },
      { id: "placed", label: "Placed", count: 6 },
    ]},
    { title: "System", items: [
      { id: "ds", label: "Design System" },
      { id: "audit", label: "Audit Log" },
    ]},
  ];

  const commands: CommandItem[] = [
    { id: "accept-all", group: "Parser", label: "Accept all parsed fields", run: acceptAll },
    ...pendingSkills.slice(0, 5).map((s) => ({ id: `skill-${s}`, group: "Add skill", label: s, run: () => addSkill(s) })),
    ...available.map((t) => ({ id: `t-${t.to}`, group: "Lifecycle", label: t.label, run: () => applyTransition(t.to, t.label) })),
    { id: "commit", group: "Actions", label: "Resolve Candidate", shortcut: "⏎", run: commit },
  ];

  const titleLabel = draft.fullName || draft.email || "Unresolved candidate";

  return (
    <EnterpriseShell
      brand={{ mark: "A", name: "Aberdeen", sub: "LAWRENCE · LDS-001" }}
      groups={navGroups}
      footer={<span>Candidate Studio · v1</span>}
    >
      <Topbar crumbs={["Resolve", "New Candidate", titleLabel]}>
        <CommandTrigger onClick={() => setOpen(true)} />
      </Topbar>

      <Workspace>
        <WorkspaceHead
          title="Candidate Studio"
          desc="Resolve a canonical Candidate from inbound signal. The form, lifecycle and readiness gate are projected from the registered Candidate object definition — parsed resume data enters only as evidence you accept."
        >
          <div className="lds-row" style={{ gap: 8 }}>
            <Badge tone={committed ? "good" : blocking ? "warn" : "brand"}>
              {committed ? "RESOLVED" : blocking ? `${blocking} TO RESOLVE` : "READY"}
            </Badge>
            <Button variant="accent" onClick={commit} disabled={committed}>{committed ? "Candidate Resolved" : "Resolve Candidate"}</Button>
          </div>
        </WorkspaceHead>

        <KpiRow>
          <Kpi value={`${readyPct}%`} label="Readiness" accent sub={`${hardChecks.length - hardChecks.filter((d) => !d.ok).length}/${hardChecks.length} hard checks`} />
          <Kpi value={draft.status} label="Lifecycle stage" sub={`${available.length} transition(s) available`} />
          <Kpi value={skills.length} label="Skills captured" sub={`${pendingSkills.length} suggested`} />
          <Kpi value={accepted.length} label="Parsed fields accepted" sub={`${pendingFields.length} pending`} />
        </KpiRow>

        <WorkspaceGrid>
          <Col>
            <Card
              title="Canonical Candidate"
              label="Projected from candidateObject"
              actions={<Badge tone="neutral">{FIELDS.length} fields</Badge>}
            >
              {FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  required={ANY_OF.fields.includes(f.key)}
                  done={!!draft[f.key as keyof Draft]?.toString().trim()}
                  hint={f.helpText}
                >
                  {f.type === "textarea" ? (
                    <Textarea value={draft[f.key as keyof Draft]} placeholder={f.placeholder} onChange={(e) => set(f.key as keyof Draft, e.target.value)} />
                  ) : f.type === "select" ? (
                    <Select value={draft[f.key as keyof Draft]} onChange={(e) => set(f.key as keyof Draft, e.target.value)}>
                      {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <Input
                      type={f.type === "email" ? "email" : "text"}
                      value={draft[f.key as keyof Draft]}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key as keyof Draft, e.target.value)}
                    />
                  )}
                </Field>
              ))}

              <Field label="Skills" done={skills.length > 0} hint="Captured from parsed evidence; used for retrieval & matching.">
                <ChipRow>
                  {skills.map((s) => <Chip key={s} state="resolved" onRemove={() => setSkills((p) => p.filter((x) => x !== s))}>{s}</Chip>)}
                  {skills.length === 0 ? <span className="lds-empty-note">No skills captured yet — accept from suggestions.</span> : null}
                </ChipRow>
              </Field>
            </Card>

            <Card
              title="Lifecycle"
              label={`${draft.status} · governed state machine`}
              actions={available.length === 0 ? <Badge tone="neutral">Terminal</Badge> : null}
            >
              <div className="lds-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {LIFECYCLE.map((s) => (
                  <Chip key={s.value} state={s.value === draft.status ? "resolved" : "suggested"}>
                    {s.label}{s.value === draft.status ? " ●" : ""}
                  </Chip>
                ))}
              </div>
              <div className="lds-row" style={{ gap: 6, flexWrap: "wrap" }}>
                {available.length === 0
                  ? <span className="lds-empty-note">No further transitions from this stage.</span>
                  : available.map((t) => (
                    <Button key={t.to} size="sm" variant="primary" onClick={() => applyTransition(t.to, t.label)}>{t.label} →</Button>
                  ))}
              </div>
            </Card>
          </Col>

          <Col>
            <Inspector
              title="Inspector"
              tabs={[{ id: "object", label: "Object" }, { id: "advisor", label: "Advisor" }, { id: "diagnostics", label: "Diagnostics" }, { id: "activity", label: "Activity" }]}
              active={tab}
              onTab={setTab}
            >
              {tab === "object" && (
                <>
                  <PropertyRow k="Type">{candidateObject.displayName}</PropertyRow>
                  <PropertyRow k="Status">{committed ? <Badge tone="good">RESOLVED</Badge> : <Badge tone="neutral">DRAFT</Badge>}</PropertyRow>
                  <PropertyRow k="Title">{titleLabel}</PropertyRow>
                  <PropertyRow k="Email">{draft.email || <EmptyValue />}</PropertyRow>
                  <PropertyRow k="Stage">{draft.status}</PropertyRow>
                  <PropertyRow k="Skills">{skills.length}</PropertyRow>
                  <PropertyRow k="Readiness">{readyPct}%</PropertyRow>
                </>
              )}
              {tab === "advisor" && (
                <AdvisorRail>
                  <AdvisorItem tone="advise" title="Most likely next" confidence="91%">
                    {!anyOfOk ? "Accept the parsed name or email to satisfy the identity rule."
                      : pendingFields.length ? `${pendingFields.length} parsed field(s) await your review.`
                      : blocking ? "Resolve open diagnostics, then commit." : "Candidate is clean — resolve, then advance the lifecycle."}
                  </AdvisorItem>
                  {pendingFields.length > 0 && (
                    <AdvisorItem tone="suggest" title="Parsed resume on file" confidence="parser" actions={<Button size="sm" variant="ghost" onClick={acceptAll}>Accept all</Button>}>
                      A resume was parsed into {pendingFields.length} unaccepted field(s). Review before applying — parsing is advisory.
                    </AdvisorItem>
                  )}
                  {!emailOk && <AdvisorItem tone="warn" title="Email malformed">The email does not match a valid pattern.</AdvisorItem>}
                </AdvisorRail>
              )}
              {tab === "diagnostics" && (
                <Diagnostics>
                  {diagnostics.map((d) => (
                    <DiagnosticRow
                      key={d.id}
                      tone={d.ok ? "good" : d.soft ? "info" : "warn"}
                      label={d.label}
                      detail={d.detail}
                      badge={<Badge tone={d.ok ? "good" : d.soft ? "neutral" : "warn"}>{d.ok ? "PASS" : d.soft ? "ADVISORY" : "OPEN"}</Badge>}
                    />
                  ))}
                </Diagnostics>
              )}
              {tab === "activity" && (
                <Timeline>
                  {activity.map((a) => <TimelineItem key={a.id} tone={a.tone} title={a.title} meta={a.meta} />)}
                </Timeline>
              )}
            </Inspector>

            <Card title="Parsed evidence" label="Inbound signal · not yet applied">
              <EvidencePanel>
                {pendingFields.length === 0 && pendingSkills.length === 0 ? (
                  <span className="lds-empty-note">All parsed signal has been reviewed.</span>
                ) : (
                  <>
                    {pendingFields.map((k) => (
                      <EvidenceItem
                        key={k}
                        title={`Parsed ${k}`}
                        source="parser:resume"
                        provenance="extracted · accept to apply"
                        actions={<Button size="sm" variant="quiet" onClick={() => acceptField(k)}>Accept</Button>}
                      >
                        {String((PARSED as Record<string, string>)[k])}
                      </EvidenceItem>
                    ))}
                    {pendingSkills.length > 0 && (
                      <EvidenceItem title="Parsed skills" source="parser:resume" provenance="extracted · accept individually">
                        <ChipRow>
                          {pendingSkills.map((s) => (
                            <span key={s} className="lds-row" style={{ gap: 4 }}>
                              <Chip state="pending">{s}</Chip>
                              <Button size="sm" variant="quiet" onClick={() => addSkill(s)}>+ add</Button>
                            </span>
                          ))}
                        </ChipRow>
                      </EvidenceItem>
                    )}
                  </>
                )}
              </EvidencePanel>
            </Card>
          </Col>
        </WorkspaceGrid>
      </Workspace>

      <CommandCenter open={open} onClose={() => setOpen(false)} items={commands} />
    </EnterpriseShell>
  );
}
