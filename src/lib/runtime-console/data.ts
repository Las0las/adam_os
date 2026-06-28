// ─────────────────────────────────────────────────────────────────────────
// LAWRENCE — Enterprise Object Runtime · command-center fixtures
// Aberdeen Recruiting workspace. Pure data: surfaces project these, never mutate.
// ─────────────────────────────────────────────────────────────────────────

export type IconKey =
  | "candidate"
  | "job"
  | "company"
  | "interview"
  | "offer"
  | "placement"
  | "document"
  | "approval"
  | "workflow"
  | "policy"
  | "revenue";

export type Tone = "accent" | "good" | "warn" | "bad" | "muted";

export interface ObjectStat {
  readonly label: string;
  readonly tone: Tone;
}

export interface EnterpriseObject {
  readonly id: string;
  readonly icon: IconKey;
  readonly name: string;
  /** primary count line, e.g. "318 objects" or "QTD $4.2M". */
  readonly count: string;
  /** small pill rendered at the row's top-right (optional). */
  readonly flag?: ObjectStat;
  /** inline status chips under the name. */
  readonly stats: readonly ObjectStat[];
}

export const ENTERPRISE_OBJECTS: readonly EnterpriseObject[] = [
  {
    id: "candidates",
    icon: "candidate",
    name: "Candidates",
    count: "318 objects",
    flag: { label: "4 approve", tone: "accent" },
    stats: [
      { label: "12 active", tone: "good" },
      { label: "47 at risk", tone: "bad" },
    ],
  },
  {
    id: "jobs",
    icon: "job",
    name: "Jobs",
    count: "42 objects",
    flag: { label: "3 critical", tone: "bad" },
    stats: [
      { label: "8 open", tone: "good" },
      { label: "2 on hold", tone: "warn" },
    ],
  },
  {
    id: "companies",
    icon: "company",
    name: "Companies",
    count: "86 objects",
    stats: [
      { label: "63 active", tone: "good" },
      { label: "5 risk", tone: "bad" },
    ],
  },
  {
    id: "interviews",
    icon: "interview",
    name: "Interviews",
    count: "156 objects",
    stats: [
      { label: "24 today", tone: "accent" },
      { label: "18 pending", tone: "warn" },
    ],
  },
  {
    id: "offers",
    icon: "offer",
    name: "Offers",
    count: "6 objects",
    stats: [
      { label: "2 expiring", tone: "bad" },
      { label: "1 pending", tone: "warn" },
    ],
  },
  {
    id: "placements",
    icon: "placement",
    name: "Placements",
    count: "22 objects",
    stats: [
      { label: "14 active", tone: "good" },
      { label: "3 completing", tone: "accent" },
    ],
  },
  {
    id: "documents",
    icon: "document",
    name: "Documents",
    count: "1.2K objects",
    stats: [
      { label: "134 updated", tone: "accent" },
      { label: "7 review", tone: "warn" },
    ],
  },
  {
    id: "approvals",
    icon: "approval",
    name: "Approvals",
    count: "24 objects",
    stats: [
      { label: "6 awaiting", tone: "warn" },
      { label: "2 overdue", tone: "bad" },
    ],
  },
  {
    id: "workflows",
    icon: "workflow",
    name: "Workflows",
    count: "68 objects",
    stats: [
      { label: "8 running", tone: "good" },
      { label: "3 delayed", tone: "warn" },
    ],
  },
  {
    id: "policies",
    icon: "policy",
    name: "Policies",
    count: "52 objects",
    stats: [
      { label: "41 passing", tone: "good" },
      { label: "1 warning", tone: "warn" },
    ],
  },
  {
    id: "revenue",
    icon: "revenue",
    name: "Revenue",
    count: "QTD $4.2M",
    stats: [{ label: "-6.3% vs last QTD", tone: "bad" }],
  },
];

export interface RecentCommand {
  readonly id: string;
  readonly icon: IconKey;
  readonly label: string;
  readonly ago: string;
}

export const RECENT_COMMANDS: readonly RecentCommand[] = [
  { id: "c1", icon: "candidate", label: "Compare Sarah Chen against JR-118", ago: "2m ago" },
  { id: "c2", icon: "offer", label: "Approve low-risk offers", ago: "18m ago" },
  { id: "c3", icon: "revenue", label: "Why is revenue down?", ago: "32m ago" },
  { id: "c4", icon: "interview", label: "Schedule interviews for JR-118", ago: "1h ago" },
  { id: "c5", icon: "workflow", label: "Generate outreach for finalists", ago: "2h ago" },
];

export interface SelectedObject {
  readonly id: string;
  readonly icon: IconKey;
  readonly name: string;
  readonly kind: string;
}

export const PROMPT_TEXT = "Compare Sarah Chen against JR-118";

export const SELECTED_OBJECTS: readonly SelectedObject[] = [
  { id: "sarah-chen", icon: "candidate", name: "Sarah Chen", kind: "Candidate" },
  { id: "jr-118", icon: "job", name: "JR-118", kind: "Job" },
];

// ── Execution plan ─────────────────────────────────────────────────────────

export type StageKey =
  | "intent"
  | "objects"
  | "runtime"
  | "capabilities"
  | "governance"
  | "confidence";

export interface PipelineStage {
  readonly key: StageKey;
  readonly icon: "intent" | "objects" | "runtime" | "capabilities" | "governance" | "confidence";
  readonly title: string;
  readonly detail: string;
  /** secondary status word shown to the right of the detail, e.g. "Ready". */
  readonly status?: string;
  readonly statusTone?: Tone;
}

export const PIPELINE: readonly PipelineStage[] = [
  { key: "intent", icon: "intent", title: "Intent", detail: "Comparison" },
  { key: "objects", icon: "objects", title: "Objects", detail: "2 selected" },
  {
    key: "runtime",
    icon: "runtime",
    title: "Runtime",
    detail: "Comparison Runtime v1.4.2",
    status: "Ready",
    statusTone: "good",
  },
  { key: "capabilities", icon: "capabilities", title: "Capabilities", detail: "5 analyses" },
  { key: "governance", icon: "governance", title: "Governance", detail: "Read Only" },
  {
    key: "confidence",
    icon: "confidence",
    title: "Confidence",
    detail: "94% High",
    statusTone: "good",
  },
];

export interface RuntimeStatusLine {
  readonly label: string;
  readonly tone: Tone;
}

export const RUNTIME_STATUS: readonly RuntimeStatusLine[] = [
  { label: "Ready", tone: "good" },
  { label: "Version 1.4.2", tone: "muted" },
  { label: "Healthy", tone: "good" },
  { label: "21 ms latency", tone: "muted" },
];

export interface Capability {
  readonly id: string;
  readonly icon:
    | "skills"
    | "experience"
    | "culture"
    | "compensation"
    | "risk";
  readonly title: string;
  readonly desc: string;
}

export const CAPABILITIES: readonly Capability[] = [
  { id: "skills", icon: "skills", title: "Skills Match", desc: "Compare required vs. actual skills" },
  { id: "experience", icon: "experience", title: "Experience Analysis", desc: "Years, roles, and domain depth" },
  { id: "culture", icon: "culture", title: "Cultural Fit", desc: "Values and work style alignment" },
  { id: "comp", icon: "compensation", title: "Compensation Analysis", desc: "Market and internal benchmarks" },
  { id: "risk", icon: "risk", title: "Risk Assessment", desc: "Turnover and performance risk" },
];

export interface GovernanceCheck {
  readonly label: string;
  readonly value: string;
  readonly tone?: Tone;
  readonly check?: boolean;
}

export const GOVERNANCE_CHECKS: readonly GovernanceCheck[] = [
  { label: "Execution Type", value: "Read Only", tone: "muted" },
  { label: "Policies Evaluated", value: "4" },
  { label: "Policies Passed", value: "4", tone: "good", check: true },
  { label: "Approvals Required", value: "None", tone: "muted" },
  { label: "Data Access Level", value: "Authorized", tone: "good" },
  { label: "Audit Logging", value: "Enabled", tone: "good" },
];

export interface RunStat {
  readonly icon: "clock" | "data" | "cost";
  readonly label: string;
  readonly value: string;
}

export const RUN_STATS: readonly RunStat[] = [
  { icon: "clock", label: "Estimated Runtime", value: "1.2 sec" },
  { icon: "data", label: "Data Points", value: "42 sources" },
  { icon: "cost", label: "Cost", value: "Low" },
];

// ── Recommended next actions ────────────────────────────────────────────────

export interface RecommendedAction {
  readonly id: string;
  readonly icon: IconKey | "alert" | "policy";
  readonly badge?: string;
  readonly title: string;
  readonly desc: string;
  readonly cta: string;
  readonly tone: Tone;
}

export const RECOMMENDED_ACTIONS: readonly RecommendedAction[] = [
  {
    id: "ra1",
    icon: "candidate",
    badge: "2",
    title: "Candidates awaiting approval",
    desc: "Review and approve",
    cta: "Review",
    tone: "accent",
  },
  {
    id: "ra2",
    icon: "interview",
    badge: "3",
    title: "Interviews need scheduling",
    desc: "Schedule to keep pipeline moving",
    cta: "Schedule",
    tone: "accent",
  },
  {
    id: "ra3",
    icon: "revenue",
    title: "Revenue risk detected",
    desc: "-6.3% vs last QTD",
    cta: "Investigate",
    tone: "bad",
  },
  {
    id: "ra4",
    icon: "offer",
    badge: "1",
    title: "Offer expires tomorrow",
    desc: "Take action to avoid lapse",
    cta: "Open Offer",
    tone: "warn",
  },
  {
    id: "ra5",
    icon: "policy",
    title: "Policy conflict found",
    desc: "1 requires review",
    cta: "Resolve",
    tone: "warn",
  },
];

// ── Right rail ───────────────────────────────────────────────────────────────

export interface PlanDetailStep {
  readonly title: string;
  readonly lines: readonly string[];
  readonly bullets?: readonly string[];
  readonly confidence?: number;
}

export const PLAN_DETAIL: readonly PlanDetailStep[] = [
  { title: "Intent", lines: ["Comparison"] },
  { title: "Objects", lines: ["Sarah Chen (Candidate)", "JR-118 (Job)"] },
  { title: "Runtime", lines: ["Comparison Runtime v1.4.2"] },
  {
    title: "Capabilities",
    lines: [],
    bullets: ["Skills Match", "Experience Analysis", "Cultural Fit", "Compensation Analysis", "Risk Assessment"],
  },
  { title: "Governance", lines: ["Read Only · No approvals"] },
  { title: "Confidence", lines: ["94% High"], confidence: 94 },
];

export interface InsightMetric {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
  /** normalized 0..1 sparkline samples. */
  readonly spark: readonly number[];
}

export const RUNTIME_INSIGHTS: readonly InsightMetric[] = [
  { label: "Response Time", value: "21 ms", tone: "good", spark: [0.5, 0.42, 0.6, 0.38, 0.46, 0.3, 0.34, 0.28] },
  { label: "Throughput", value: "128 rps", tone: "accent", spark: [0.3, 0.45, 0.4, 0.62, 0.55, 0.7, 0.66, 0.8] },
  { label: "Health", value: "Healthy", tone: "good", spark: [0.6, 0.62, 0.58, 0.64, 0.6, 0.66, 0.63, 0.65] },
];

export interface ActivityItem {
  readonly id: string;
  readonly icon: IconKey | "alert" | "briefing";
  readonly label: string;
  readonly ago: string;
  readonly tone: Tone;
}

export const LIVE_ACTIVITY: readonly ActivityItem[] = [
  { id: "a1", icon: "interview", label: "JR-118 interview completed", ago: "5m ago", tone: "good" },
  { id: "a2", icon: "candidate", label: "Sarah Chen moved to Final Round", ago: "18m ago", tone: "accent" },
  { id: "a3", icon: "offer", label: "Offer approved for Michael Chen", ago: "32m ago", tone: "good" },
  { id: "a4", icon: "alert", label: "Revenue risk increased for 2 roles", ago: "1h ago", tone: "bad" },
  { id: "a5", icon: "briefing", label: "Daily briefing ready", ago: "2h ago", tone: "muted" },
];

// ── Footer context ───────────────────────────────────────────────────────────

export const FOOTER_CONTEXT: readonly { icon: IconKey; label: string; value: string }[] = [
  { icon: "job", label: "Jobs", value: "42" },
  { icon: "candidate", label: "Candidates", value: "318" },
  { icon: "offer", label: "Offers", value: "6" },
  { icon: "interview", label: "Interviews", value: "156" },
];

export const SCOPES = ["North America", "EMEA", "APAC", "Global"] as const;
export type Scope = (typeof SCOPES)[number];

// ── Universal Workspace inspector (read-only projection) ─────────────────────

export interface WorkspaceProjection {
  readonly objectId: string;
  readonly overview: readonly { label: string; value: string }[];
  readonly relationships: readonly { kind: string; name: string; rel: string }[];
  readonly evidence: readonly { source: string; detail: string; confidence: number }[];
  readonly actions: readonly { label: string; access: string }[];
  readonly audit: readonly { at: string; actor: string; event: string }[];
}

export const WORKSPACE_PROJECTIONS: Record<string, WorkspaceProjection> = {
  "sarah-chen": {
    objectId: "sarah-chen",
    overview: [
      { label: "Type", value: "Candidate" },
      { label: "Stage", value: "Final Round" },
      { label: "Role Target", value: "Senior Platform Engineer" },
      { label: "Location", value: "Toronto, CA" },
      { label: "Match Confidence", value: "94% · High" },
      { label: "Risk", value: "Low" },
    ],
    relationships: [
      { kind: "Job", name: "JR-118 · Senior Platform Engineer", rel: "Considered for" },
      { kind: "Company", name: "Aberdeen Cloud", rel: "Hiring account" },
      { kind: "Interview", name: "Final Round · completed", rel: "Attended" },
      { kind: "Document", name: "Resume v3 · Portfolio", rel: "Provided" },
    ],
    evidence: [
      { source: "Skills graph", detail: "9 of 10 required skills matched", confidence: 0.92 },
      { source: "Experience model", detail: "7 yrs, 2 platform roles, domain depth high", confidence: 0.88 },
      { source: "Compensation index", detail: "Within internal band for level", confidence: 0.81 },
    ],
    actions: [
      { label: "Advance to Offer", access: "Requires approval" },
      { label: "Request reference", access: "Authorized" },
      { label: "Compare against role", access: "Read only" },
    ],
    audit: [
      { at: "18m ago", actor: "R. Hall", event: "Moved to Final Round" },
      { at: "2d ago", actor: "Runtime", event: "Skills Match projected (94%)" },
      { at: "4d ago", actor: "A. Parson", event: "Added to JR-118 pipeline" },
    ],
  },
  "jr-118": {
    objectId: "jr-118",
    overview: [
      { label: "Type", value: "Job" },
      { label: "Title", value: "Senior Platform Engineer" },
      { label: "Status", value: "Open · Critical" },
      { label: "Account", value: "Aberdeen Cloud" },
      { label: "Openings", value: "2" },
      { label: "Pipeline", value: "12 active candidates" },
    ],
    relationships: [
      { kind: "Company", name: "Aberdeen Cloud", rel: "Owned by" },
      { kind: "Candidate", name: "Sarah Chen · Final Round", rel: "Top match" },
      { kind: "Workflow", name: "Coverage Workflow 360", rel: "Running" },
      { kind: "Policy", name: "FIN-LOCK margin floor", rel: "Enforced" },
    ],
    evidence: [
      { source: "Demand model", detail: "Critical coverage, 2 openings unfilled", confidence: 0.9 },
      { source: "Skill requirement graph", detail: "10 hard skills, 3 rare", confidence: 0.86 },
      { source: "Market index", detail: "Compensation moving +2%/month", confidence: 0.74 },
    ],
    actions: [
      { label: "Open pipeline", access: "Read only" },
      { label: "Generate shortlist", access: "Authorized" },
      { label: "Adjust comp band", access: "Requires approval" },
    ],
    audit: [
      { at: "5m ago", actor: "Runtime", event: "Interview completed event ingested" },
      { at: "1h ago", actor: "Runtime", event: "Coverage risk re-projected" },
      { at: "3d ago", actor: "R. Hall", event: "Requisition opened" },
    ],
  },
};
