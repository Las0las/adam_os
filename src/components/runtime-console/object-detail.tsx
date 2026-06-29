"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LAWRENCE · Enterprise Object Runtime — People object-detail surface.
//   Faithful reproduction of the provided mockup. Chrome is presentational;
//   the LIVE / governed core (status badge, quick actions, timeline, pager)
//   binds to the shared event-sourced `runtime-store` — the same store that
//   drives /lis. Governed mutations emit reversible events and re-project here.
//   The mockup's blue annotation callouts are implemented as REAL affordances
//   (index hover preview, working command chips, governed quick actions).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon, ArrowUp, BarChart3, Bell, BookOpen, Boxes,
  Briefcase, Building2, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Command, Cpu, ExternalLink, FileText, GitBranch, Home,
  Inbox, LayoutDashboard, Layers, Lightbulb, Link2, Mail, MapPin,
  MessageSquare, MoreHorizontal, Phone, Plus, ScrollText, Search, Share2,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, Target, User, UserCheck,
  UserCog, Users,
} from "lucide-react";
import {
  CANDIDATE_STAGES, runtimeStore, useRuntimeEvents, useRuntimeObject,
  useRuntimeProjection, type RuntimeInstance, type Stage, type Tone,
} from "./runtime-store";
import "./object-detail.css";

// ── Presentational enrichment ────────────────────────────────────────────────
// The thin store row carries the LIVE truth (label/stage/metric/tags). This map
// supplies the rich object attributes the surface renders; keyed by instance id.
interface PersonDetail {
  photo?: string;
  peopleId: string;
  location: string;
  email: string;
  phone: string;
  current: string;
  tenure: string;
  source: string;
  ownerName: string;
  availability: string;
  rate: string;
  relocation: string;
  workAuth: string;
  summary: string;
  matchBars: { label: string; value: number }[];
  acceptLikelihood: number;
  whyMatch: string[];
  related: { type: string; icon: "job" | "interview" | "hm" | "workflow"; title: string; sub: string; badge?: string; tone?: Tone }[];
  activity: { title: string; sub: string; time: string }[];
  workflowName: string;
  workflowSteps: { name: string; state: "done" | "active" | "pending" }[];
  files: { name: string; meta: string }[];
  timeline: { title: string; sub: string }[];
}

const SARAH: PersonDetail = {
  photo: "/images/oer/sarah-chen.png",
  peopleId: "C-12874",
  location: "Austin, TX (Remote)",
  email: "sarah.chen@email.com",
  phone: "(512) 555-0198",
  current: "TechCorp",
  tenure: "2.4 years",
  source: "LinkedIn",
  ownerName: "Michael Rodriguez",
  availability: "2 weeks",
  rate: "$85/hr C2C",
  relocation: "Open to Relocate",
  workAuth: "US Citizen",
  summary:
    "Senior Data Engineer with 6.4 years of experience designing and building scalable data pipelines and analytics platforms. Expert in Python, SQL, Spark, and AWS. Strong background in data modeling, ETL/ELT, and real-time analytics. Proven track record of delivering high-impact data solutions in fast-paced environments.",
  matchBars: [
    { label: "Skills", value: 95 },
    { label: "Experience", value: 91 },
    { label: "Culture", value: 88 },
    { label: "Location", value: 100 },
    { label: "Comp Alignment", value: 85 },
  ],
  acceptLikelihood: 78,
  whyMatch: ["Exact skills match", "Relevant industry experience", "Culture add", "Immediate impact"],
  related: [
    { type: "Job", icon: "job", title: "JR-118 · Senior Data Engineer", sub: "TechCorp", badge: "Final Round", tone: "good" },
    { type: "Interview", icon: "interview", title: "INT-3321 · Technical Interview", sub: "Panel · 3 interviewers", badge: "Completed", tone: "good" },
    { type: "Hiring Manager", icon: "hm", title: "John Anderson", sub: "Director of Data", tone: "muted" },
    { type: "Workflow", icon: "workflow", title: "WF-776 · Hiring Workflow", sub: "5 of 6 stages", badge: "Active", tone: "amber" },
  ],
  activity: [
    { title: "Interview completed — Technical", sub: "May 12, 2024", time: "2h ago" },
    { title: "Assessment submitted", sub: "May 10, 2024", time: "2d ago" },
    { title: "Phone screen completed", sub: "May 8, 2024", time: "4d ago" },
    { title: "Application received", sub: "May 6, 2024", time: "6d ago" },
  ],
  workflowName: "WF-776 · Hiring Workflow",
  workflowSteps: [
    { name: "Application", state: "done" },
    { name: "Phone Screen", state: "done" },
    { name: "Technical Interview", state: "done" },
    { name: "Hiring Manager Interview", state: "done" },
    { name: "Final Round", state: "active" },
    { name: "Offer", state: "pending" },
  ],
  files: [
    { name: "Resume_SarahChen.pdf", meta: "PDF · May 6, 2024" },
    { name: "Portfolio_DataProjects.pdf", meta: "PDF · May 6, 2024" },
    { name: "Assessment_Results.pdf", meta: "PDF · May 10, 2024" },
    { name: "Reference_Check.docx", meta: "DOCX · May 11, 2024" },
  ],
  timeline: [
    { title: "Status changed to Final Round", sub: "by Michael Rodriguez · May 12, 2024 · 2h ago" },
    { title: "Interview completed", sub: "by Sarah Chen · May 12, 2024 · 2h ago" },
    { title: "Assessment submitted", sub: "by Sarah Chen · May 10, 2024 · 2d ago" },
  ],
};

/** Derive a presentational detail for any candidate instance (Sarah is rich). */
function detailFor(inst: RuntimeInstance): PersonDetail {
  if (inst.id === "sarah-chen") return SARAH;
  const seedBars = [
    { label: "Skills", value: clamp(inst.metricValue + 2) },
    { label: "Experience", value: clamp(inst.metricValue - 3) },
    { label: "Culture", value: clamp(inst.metricValue - 6) },
    { label: "Location", value: 100 },
    { label: "Comp Alignment", value: clamp(inst.metricValue - 9) },
  ];
  return {
    peopleId: `C-${10000 + Math.abs(hash(inst.id)) % 9000}`,
    location: "Remote · US",
    email: `${inst.label.toLowerCase().replace(/[^a-z]+/g, ".")}@email.com`,
    phone: "(512) 555-0100",
    current: inst.detail,
    tenure: "—",
    source: "LinkedIn",
    ownerName: "Michael Rodriguez",
    availability: "2 weeks",
    rate: "$85/hr C2C",
    relocation: "Open to Relocate",
    workAuth: "US Citizen",
    summary: `${inst.detail} with strong delivery history. Projected from the canonical object graph; the live stage and governed actions reflect real runtime state.`,
    matchBars: seedBars,
    acceptLikelihood: clamp(inst.metricValue - 14),
    whyMatch: inst.tags.length ? inst.tags.slice(0, 4) : ["Relevant experience", "Available now"],
    related: [
      { type: "Job", icon: "job", title: "JR-118 · Senior Data Engineer", sub: "TechCorp", badge: inst.stage ?? "Open", tone: "good" },
      { type: "Workflow", icon: "workflow", title: "WF-776 · Hiring Workflow", sub: "Active", badge: "Active", tone: "amber" },
    ],
    activity: [
      { title: "Application received", sub: "May 6, 2024", time: "6d ago" },
    ],
    workflowName: "WF-776 · Hiring Workflow",
    workflowSteps: CANDIDATE_STAGES.map((s) => ({
      name: s,
      state: stageIndexOf(inst.stage) > CANDIDATE_STAGES.indexOf(s) ? "done"
        : inst.stage === s ? "active" : "pending",
    })),
    files: [{ name: `Resume_${inst.label.split(" ")[0]}.pdf`, meta: "PDF · May 6, 2024" }],
    timeline: [{ title: `Stage: ${inst.stage ?? "—"}`, sub: "Projected from runtime" }],
  };
}

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function stageIndexOf(s: Stage | null) { return s ? CANDIDATE_STAGES.indexOf(s) : -1; }

const STAGE_TONE: Record<Stage, Tone> = {
  Sourced: "muted", Screen: "blue", Submitted: "blue", Interview: "amber", Offer: "good", Placed: "good",
};
function toneClass(t: Tone): string {
  return t === "good" ? "green" : t === "warn" || t === "amber" ? "amber" : t === "bad" ? "amber" : t === "accent" ? "blue" : "muted";
}

// ── Left nav + indexes config ─────────────────────────────────────────────────
const NAV = [
  { icon: Home, label: "Home" }, { icon: Inbox, label: "Inbox", count: 12 },
  { icon: Boxes, label: "Objects", active: true }, { icon: Briefcase, label: "Work" },
  { icon: Lightbulb, label: "Insights" }, { icon: CheckCircle2, label: "Approvals" },
  { icon: BookOpen, label: "Knowledge" }, { icon: BarChart3, label: "Reports" },
  { icon: LayoutDashboard, label: "Dashboards" }, { icon: ScrollText, label: "Audit Trail" },
];
const INDEXES = [
  { icon: Users, label: "All People", count: "1,842", active: true, note: "Every person object across the workspace." },
  { icon: User, label: "Employees", count: "1,126", note: "Active W-2 employees." },
  { icon: User, label: "Candidates", count: "682", note: "People in an active hiring pipeline." },
  { icon: UserCog, label: "Contractors", count: "34", note: "1099 / C2C contractors." },
  { icon: UserCheck, label: "Active Candidates", count: "318", note: "Candidates with an open submission." },
  { icon: Target, label: "Interviewing", count: "126", note: "Currently in an interview loop." },
  { icon: Target, label: "Final Round", count: "42", note: "Reached the final interview stage." },
  { icon: CheckCircle2, label: "Offers Extended", count: "28", note: "Live offers awaiting decision." },
  { icon: CheckCircle2, label: "Placed (Last 90 Days)", count: "38", note: "Recently placed candidates." },
  { icon: Layers, label: "Talent Pool", count: "442", note: "Nurtured talent, no active req." },
  { icon: Users, label: "Alumni", count: "126", note: "Former employees and placements." },
];
const SURFACE_TABS = ["Overview", "Profile", "Experience", "Skills", "Activity", "Files", "Notes", "Workflow", "Timeline", "Relationships"];
const COMMANDS = ["/compare Sarah Chen to JR-118", "/show all interviews", "/check offer likelihood", "/generate outreach", "/show skills gap analysis", "/add note"];

type Toast = { id: number; text: string };

// ── Component ─────────────────────────────────────────────────────────────────
export function ObjectDetail({ initialId = "sarah-chen" }: { initialId?: string }) {
  const all = useRuntimeProjection();
  const candidates = useRuntimeObject("candidates");
  const events = useRuntimeEvents();

  const [activeId, setActiveId] = useState(initialId);
  const [tab, setTab] = useState("Overview");
  const [starred, setStarred] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pulseKey, setPulseKey] = useState(0);
  const toastSeq = useRef(0);

  const inst = useMemo(() => all.find((i) => i.id === activeId) ?? candidates[0], [all, candidates, activeId]);
  const detail = useMemo(() => (inst ? detailFor(inst) : null), [inst]);

  const idx = candidates.findIndex((c) => c.id === inst?.id);

  const toast = useCallback((text: string) => {
    const id = toastSeq.current++;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // Live events for THIS instance → merged into Timeline & Latest Activity.
  const liveEvents = useMemo(
    () => events.filter((e) => e.instanceId === inst?.id && e.type !== "object.seeded").slice().reverse(),
    [events, inst?.id],
  );

  // Governed actions (emit reversible events; surface re-projects via the store).
  const nextStage = inst?.stage ? CANDIDATE_STAGES[CANDIDATE_STAGES.indexOf(inst.stage) + 1] : undefined;
  const advance = useCallback(() => {
    if (!inst || !nextStage) return;
    if (runtimeStore.advanceStage(inst.id)) { toast(`${inst.label} moved to ${nextStage}`); setPulseKey((k) => k + 1); }
  }, [inst, nextStage, toast]);
  const addNote = useCallback(() => {
    if (!inst) return;
    const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (runtimeStore.tag([inst.id], `Note ${stamp}`)) { toast("Note added · governed event appended"); setPulseKey((k) => k + 1); }
  }, [inst, toast]);
  const copyLink = useCallback(() => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/object/${inst?.id}` : "";
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link to candidate copied")).catch(() => {});
    else toast("Link to candidate copied");
  }, [inst?.id, toast]);

  const pivot = useCallback((dir: -1 | 1) => {
    if (candidates.length === 0) return;
    const ni = (idx + dir + candidates.length) % candidates.length;
    setActiveId(candidates[ni]!.id); setTab("Overview");
  }, [candidates, idx]);

  // Keyboard shortcuts (badges shown on the action buttons).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "o") { e.preventDefault(); advance(); }
      else if (e.key === "n") { e.preventDefault(); addNote(); }
      else if (e.key === "ArrowRight") pivot(1);
      else if (e.key === "ArrowLeft") pivot(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, addNote, pivot]);

  const runCommand = useCallback((cmd: string) => {
    if (cmd.includes("offer likelihood")) toast(`Offer-accept likelihood: ${detail?.acceptLikelihood ?? "—"}%`);
    else if (cmd.includes("skills gap")) setTab("Skills");
    else if (cmd.includes("all interviews")) setTab("Activity");
    else if (cmd.includes("add note")) addNote();
    else if (cmd.includes("compare")) toast("Comparison drafted vs JR-118");
    else toast(`Command queued: ${cmd}`);
  }, [detail, addNote, toast]);

  if (!inst || !detail) return <div className="oer" style={{ padding: 40 }}>No object found.</div>;

  const statusTone = inst.stage ? STAGE_TONE[inst.stage] : "muted";
  const headlineScore = inst.metricValue;

  return (
    <div className="oer">
      <Topbar />
      <div className="oer-body">
        <Sidebar candidateCount={candidates.length} />
        <main className="oer-main">
          <div className="oer-main-inner">
            <ContextStrip />
            <div className="oer-columns">
              {/* CENTER */}
              <div className="oer-center">
                <div className="oer-crumbrow">
                  <nav className="oer-crumb" aria-label="Breadcrumb">
                    <button onClick={() => toast("Objects")}>Objects</button>
                    <ChevronRight size={13} />
                    <button onClick={() => toast("People index")}>People</button>
                    <ChevronRight size={13} />
                    <span className="oer-crumb-cur">{inst.label}</span>
                  </nav>
                  <div className="oer-crumb-tools">
                    <span className="oer-pager">
                      <button aria-label="Previous" onClick={() => pivot(-1)}><ChevronLeft size={14} /></button>
                      {idx + 1} of 1,842
                      <button aria-label="Next" onClick={() => pivot(1)}><ChevronRight size={14} /></button>
                    </span>
                    <button className="oer-st-btn" onClick={() => toast("Actions menu")}><ChevronDown size={13} /> Actions</button>
                    <button className="oer-st-btn" onClick={copyLink}><Share2 size={13} /> Share</button>
                  </div>
                </div>

                {/* Header card */}
                <div className="oer-card">
                  <div className="oer-head">
                    {detail.photo
                      ? <img className="oer-head-photo" src={detail.photo} alt={`${inst.label} headshot`} crossOrigin="anonymous" />
                      : <div className="oer-head-photo" style={{ display: "grid", placeItems: "center", color: "#0f3a5f", fontWeight: 700, fontSize: 26 }}>{initials(inst.label)}</div>}
                    <div className="oer-head-main">
                      <div className="oer-head-namerow">
                        <span className="oer-head-name">{inst.label}</span>
                        <button className={`oer-star${starred ? " on" : ""}`} aria-label="Star" onClick={() => setStarred((s) => !s)}>
                          <Star size={17} fill={starred ? "#f59e0b" : "none"} />
                        </button>
                        <span key={pulseKey} className={`oer-tag ${toneClass(statusTone)} oer-pulse`}>{inst.stage ?? "—"}</span>
                      </div>
                      <div className="oer-head-role">{detail.current ? `Senior Data Engineer` : inst.detail}</div>
                      <div className="oer-head-meta">
                        <span className="oer-head-fact"><span className="oer-ico"><MapPin size={13} /></span>{detail.location}</span>
                        <span className="oer-head-fact"><span className="oer-ico"><User size={13} /></span>People ID: <span className="oer-mono">{detail.peopleId}</span></span>
                      </div>
                      <div className="oer-head-meta">
                        <span className="oer-head-fact"><span className="oer-ico"><Mail size={13} /></span>{detail.email}</span>
                        <span className="oer-head-fact"><span className="oer-ico"><Phone size={13} /></span>{detail.phone}</span>
                        <span className="oer-head-mini">
                          <a className="oer-mini-ic" href="#" onClick={(e) => { e.preventDefault(); toast("LinkedIn profile"); }} aria-label="LinkedIn"><ExternalLink size={13} /></a>
                          <button className="oer-mini-ic" onClick={copyLink} aria-label="Copy link"><Link2 size={13} /></button>
                        </span>
                      </div>
                    </div>
                    <div className="oer-head-side">
                      <div className="oer-head-side-row"><span className="oer-lbl">Current</span><span className="oer-val">{detail.current}</span></div>
                      <div className="oer-head-side-row"><span className="oer-lbl">Tenure</span><span className="oer-val">{detail.tenure}</span></div>
                      <div className="oer-head-side-row"><span className="oer-lbl">Source</span><span className="oer-val">{detail.source}</span></div>
                      <div className="oer-head-side-row"><span className="oer-lbl">Owner</span><span className="oer-val"><span className="oer-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{initials(detail.ownerName)}</span>{detail.ownerName}</span></div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="oer-tabs" role="tablist">
                  {SURFACE_TABS.map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} className={`oer-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
                  ))}
                </div>

                {tab === "Overview" ? (
                  <OverviewBody inst={inst} detail={detail} liveEvents={liveEvents} onCommand={runCommand} />
                ) : (
                  <div className="oer-card">
                    <div className="oer-card-title">{tab}</div>
                    <p className="oer-insight" style={{ marginTop: 10 }}>
                      <b>{tab}</b> surface — a projected lens of the same {inst.label} object. The object identity, governance, and event log are shared across every surface tab.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT */}
              <aside className="oer-right">
                <div className="oer-card">
                  <div className="oer-card-head"><span className="oer-card-title">Match Score</span></div>
                  <div className="oer-score-big">
                    <span className="oer-score-num">{headlineScore}%</span>
                    <span className="oer-score-lbl">{headlineScore >= 90 ? "Excellent Match" : headlineScore >= 75 ? "Strong Match" : "Possible Match"}</span>
                  </div>
                  <div className="oer-bars">
                    {detail.matchBars.map((b) => (
                      <div className="oer-bar-row" key={b.label}>
                        <span className="oer-bar-lbl">{b.label}</span>
                        <span className="oer-bar-track"><span className="oer-bar-fill" style={{ width: `${b.value}%` }} /></span>
                        <span className="oer-bar-val">{b.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="oer-card">
                  <div className="oer-card-head"><span className="oer-card-title">AI Insights</span><Sparkles size={14} color="#4f46e5" /></div>
                  <p className="oer-insight">{inst.label.split(" ")[0]} has a <b>{detail.acceptLikelihood}% likelihood</b> of accepting an offer based on compensation, role fit, and company alignment.</p>
                  <button className="oer-card-link" style={{ marginTop: 10 }} onClick={() => toast("Full analysis opened")}>View full analysis →</button>
                </div>

                <div className="oer-card">
                  <div className="oer-card-head"><span className="oer-card-title">Actions</span></div>
                  <div className="oer-actions-grid">
                    <button className="oer-act primary" onClick={advance} disabled={!nextStage} title={nextStage ? `Move to ${nextStage}` : "Final stage"}>
                      <span className="oer-act-ic"><ArrowUp size={16} /></span>
                      {nextStage ? `Move to ${nextStage}` : "Placed"}
                      {nextStage && <span className="oer-act-kbd">O</span>}
                    </button>
                    <button className="oer-act" onClick={() => toast("Interview draft created")}><span className="oer-act-ic"><Calendar size={16} /></span>Schedule Interview</button>
                    <button className="oer-act" onClick={() => toast("Message composer opened")}><span className="oer-act-ic"><MessageSquare size={16} /></span>Send Message</button>
                    <button className="oer-act" onClick={copyLink}><span className="oer-act-ic"><Share2 size={16} /></span>Share Profile</button>
                    <button className="oer-act" onClick={addNote}><span className="oer-act-ic"><FileText size={16} /></span>Add Note<span className="oer-act-kbd">N</span></button>
                    <button className="oer-act" onClick={() => toast("More actions")}><span className="oer-act-ic"><MoreHorizontal size={16} /></span>More Actions</button>
                  </div>
                </div>

                <div className="oer-card">
                  <div className="oer-card-head"><span className="oer-card-title">Timeline</span><button className="oer-card-link" onClick={() => setTab("Timeline")}>View all</button></div>
                  <div className="oer-tl">
                    {liveEvents.map((e) => (
                      <div className="oer-tl-item" key={`live-${e.seq}`}>
                        <div className="oer-tl-rail"><span className="oer-tl-dot" style={{ background: "#2563eb", borderColor: "#eef4ff" }} /><span className="oer-tl-line" /></div>
                        <div className="oer-tl-body"><div className="oer-tl-title">{e.summary}</div><div className="oer-tl-sub">by {e.actor} · just now · governed</div></div>
                      </div>
                    ))}
                    {detail.timeline.map((t, i) => (
                      <div className="oer-tl-item" key={`seed-${i}`}>
                        <div className="oer-tl-rail"><span className="oer-tl-dot" /><span className="oer-tl-line" /></div>
                        <div className="oer-tl-body"><div className="oer-tl-title">{t.title}</div><div className="oer-tl-sub">{t.sub}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
          <StatusBar />
        </main>
      </div>

      <div className="oer-toasts">
        {toasts.map((t) => (
          <div className="oer-toast" key={t.id}>
            <span className="oer-ico"><CheckCircle2 size={16} /></span>{t.text}
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>Dismiss</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function initials(name: string) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

// ── Sub-surfaces ───────────────────────────────────────────────────────────────
function OverviewBody({ inst, detail, liveEvents, onCommand }: {
  inst: RuntimeInstance; detail: PersonDetail;
  liveEvents: ReadonlyArray<{ seq: number; summary: string; actor: string }>;
  onCommand: (c: string) => void;
}) {
  const relIcon = { job: Briefcase, interview: Users, hm: User, workflow: GitBranch };
  return (
    <>
      <div className="oer-card">
        <div className="oer-glance-grid">
          <div className="oer-glance">
            <div className="oer-card-title" style={{ marginBottom: 4 }}>At a Glance</div>
            <Glance label="Status" value={<span className={`oer-tag ${toneClass(inst.stage ? STAGE_TONE[inst.stage] : "muted")}`}>{inst.stage ?? "—"}</span>} />
            <Glance label="Match Score" value={<span><b>{inst.metricValue}%</b> Excellent</span>} />
            <Glance label="Availability" value={detail.availability} />
            <Glance label="Preferred Rate" value={detail.rate} />
            <Glance label="Relocation" value={detail.relocation} />
            <Glance label="Work Authorization" value={detail.workAuth} />
          </div>
          <div className="oer-summary">
            <div className="oer-card-title" style={{ marginBottom: 8 }}>Summary</div>
            <p>{detail.summary}</p>
            <button className="oer-summary-more" onClick={() => onCommand("/show more")}>Show more</button>
            <div className="oer-why">
              <div className="oer-why-head">Why {inst.label.split(" ")[0]} is a strong match</div>
              <div className="oer-chips">
                {detail.whyMatch.map((w) => <span className="oer-tag indigo" key={w}><Check size={11} />{w}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="oer-panels">
        <div className="oer-card">
          <div className="oer-card-head"><span className="oer-card-title">Related Objects</span><button className="oer-card-link" onClick={() => onCommand("/related")}>View all ({detail.related.length + 5})</button></div>
          <div className="oer-list">
            {detail.related.map((r, i) => {
              const I = relIcon[r.icon];
              return (
                <div className="oer-li" key={i}>
                  <span className="oer-li-ic"><I size={14} /></span>
                  <div className="oer-li-body">
                    <div className="oer-li-title">{r.title}{r.badge && <span className={`oer-tag ${toneClass(r.tone ?? "muted")}`}>{r.badge}</span>}</div>
                    <div className="oer-li-sub">{r.type} · {r.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="oer-card">
          <div className="oer-card-head"><span className="oer-card-title">Latest Activity</span><button className="oer-card-link" onClick={() => onCommand("/show all interviews")}>View all</button></div>
          <div className="oer-list">
            {liveEvents.map((e) => (
              <div className="oer-li" key={`la-${e.seq}`}>
                <span className="oer-li-ic" style={{ borderColor: "#2563eb", color: "#2563eb" }}><ActivityIcon size={14} /></span>
                <div className="oer-li-body"><div className="oer-li-title">{e.summary}</div><div className="oer-li-sub">{e.actor} · just now</div></div>
              </div>
            ))}
            {detail.activity.map((a, i) => (
              <div className="oer-li" key={i}>
                <span className="oer-li-ic"><Clock size={14} /></span>
                <div className="oer-li-body"><div className="oer-li-title">{a.title}</div><div className="oer-li-sub">{a.sub}</div></div>
                <span className="oer-li-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="oer-card">
          <div className="oer-card-head"><span className="oer-card-title">Current Workflow</span></div>
          <div className="oer-li-sub" style={{ marginBottom: 10 }}>{detail.workflowName}</div>
          <div className="oer-wf">
            {detail.workflowSteps.map((s) => (
              <div className="oer-wf-step" key={s.name}>
                <span className={`oer-wf-dot ${s.state}`}>{s.state === "done" ? <Check size={11} /> : s.state === "active" ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} /> : null}</span>
                <span className="oer-wf-name">{s.name}</span>
                <span className={`oer-wf-state ${s.state}`}>{s.state === "done" ? "Completed" : s.state === "active" ? "In Progress" : "Pending"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="oer-card">
          <div className="oer-card-head"><span className="oer-card-title">Files & Documents</span><button className="oer-card-link" onClick={() => onCommand("/files")}>View all</button></div>
          <div className="oer-list">
            {detail.files.map((f, i) => (
              <div className="oer-li" key={i}>
                <span className="oer-li-ic"><FileText size={14} /></span>
                <div className="oer-li-body"><div className="oer-li-title">{f.name}</div><div className="oer-li-sub">{f.meta}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="oer-card">
        <div className="oer-card-head"><span className="oer-card-title">Common Commands for People <span style={{ textTransform: "none", fontWeight: 400 }}>(Try one)</span></span></div>
        <div className="oer-cmds">
          {COMMANDS.map((c) => <button className="oer-cmd" key={c} onClick={() => onCommand(c)}>{c}</button>)}
        </div>
      </div>
    </>
  );
}

function Glance({ label, value }: { label: string; value: ReactNode }) {
  return <div className="oer-glance-row"><span className="oer-lbl">{label}</span><span className="oer-val">{value}</span></div>;
}

function Topbar() {
  return (
    <header className="oer-topbar">
      <div className="oer-brand">
        <span className="oer-logo"><Layers size={18} /></span>
        <span className="oer-brand-text">
          <span className="oer-brand-name">LAWRENCE</span>
          <span className="oer-brand-sub">ENTERPRISE OBJECT RUNTIME</span>
        </span>
      </div>
      <form className="oer-omni" onSubmit={(e) => e.preventDefault()}>
        <Search size={16} color="#94a3b8" />
        <input placeholder="What outcome are you trying to achieve?" aria-label="Command" />
        <span className="oer-kbd"><Command size={11} /> K</span>
        <button className="oer-omni-send" aria-label="Submit"><ArrowUp size={15} /></button>
      </form>
      <div className="oer-top-right">
        <span className="oer-pill"><span className="oer-dot" /> 2 Advisors Active</span>
        <span className="oer-pill"><Cpu size={14} color="#94a3b8" /> 4 Runtimes Healthy</span>
        <button className="oer-iconbtn" aria-label="Notifications"><Bell size={17} /><span className="oer-badge-count">3</span></button>
        <span className="oer-avatar">AP<span className="oer-avatar-status" /></span>
      </div>
    </header>
  );
}

function Sidebar({ candidateCount }: { candidateCount: number }) {
  return (
    <aside className="oer-sidebar">
      <div className="oer-ws-card">
        <span className="oer-ws-badge">AB</span>
        <div style={{ flex: 1 }}>
          <div className="oer-ws-name">Aberdeen Recruiting</div>
          <div className="oer-ws-sub">Workspace</div>
        </div>
        <ChevronDown size={15} color="#94a3b8" />
      </div>
      <nav className="oer-nav">
        {NAV.map((n) => {
          const I = n.icon;
          return (
            <button key={n.label} className={`oer-nav-item${n.active ? " active" : ""}`}>
              <I size={16} />{n.label}
              {n.count != null && <span className="oer-nav-count">{n.count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="oer-side-head">Indexes</div>
      {INDEXES.map((ix) => {
        const I = ix.icon;
        const live = ix.label === "Candidates";
        return (
          <div className="oer-idx" key={ix.label}>
            <button className={`oer-idx-row${ix.active ? " active" : ""}`}>
              <span className="oer-idx-ico"><I size={15} /></span>{ix.label}
              <span className="oer-idx-count">{ix.count}</span>
            </button>
            <div className="oer-idx-pop" role="tooltip">
              <h5>{ix.label}</h5>
              <p>{ix.note}{live ? ` · ${candidateCount} live in this runtime.` : ""}</p>
              <div className="oer-idx-pop-actions">
                <span className="oer-tag muted">Open</span>
                <span className="oer-tag muted">Pin</span>
              </div>
            </div>
          </div>
        );
      })}
      <button className="oer-side-link"><Plus size={15} /> Create New Index</button>
      <div className="oer-side-foot">
        <button className="oer-nav-item"><SlidersHorizontal size={16} /> Customize Indexes</button>
      </div>
    </aside>
  );
}

function ContextStrip() {
  return (
    <div className="oer-context">
      <span className="oer-ctx"><span className="oer-ico"><Users size={13} /></span>Context: <b>People (1,842)</b></span>
      <span className="oer-ctx"><span className="oer-ico"><Building2 size={13} /></span>Scope: <b>Organization</b></span>
      <span className="oer-ctx"><span className="oer-ico"><ShieldCheck size={13} /></span>Governance: <b>Enforced</b></span>
      <span className="oer-ctx"><span className="oer-dot" /> Mode: <b>Live</b></span>
    </div>
  );
}

function StatusBar() {
  return (
    <footer className="oer-statusbar">
      <span className="oer-st"><span className="oer-st-lbl">Workspace</span><span className="oer-st-val"><Building2 size={13} />Aberdeen Recruiting</span></span>
      <span className="oer-st"><span className="oer-st-lbl">Context</span><span className="oer-st-val">People (1,842) · Jobs (42) · Offers (6)</span></span>
      <span className="oer-st-sep" />
      <span className="oer-st"><span className="oer-st-lbl">Scope</span><span className="oer-st-val">Organization</span></span>
      <span className="oer-st-sep" />
      <span className="oer-st"><span className="oer-st-lbl">Governance</span>
        <span className="oer-st-val"><span className="oer-ico"><ShieldCheck size={13} /></span>Secure</span>
        <span className="oer-st-val"><span className="oer-ico"><ShieldCheck size={13} /></span>Audited</span>
        <span className="oer-st-val"><span className="oer-ico"><ShieldCheck size={13} /></span>Policy Ready</span>
      </span>
      <span className="oer-st"><span className="oer-dot" /> All Systems Operational</span>
      <span className="oer-st"><span className="oer-st-lbl">Last Sync</span><span className="oer-st-val">18s ago</span></span>
      <button className="oer-st-btn"><ExternalLink size={13} /> View Audit Trail</button>
    </footer>
  );
}
