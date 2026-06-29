"use client";

// Projection Studio — governed context acquisition surface.
//
// A user edits ProjectionDefinition DSL while acquiring research from governed
// sources. The hard rule is enforced structurally: external context can only
// become a SourceObject → Evidence → a PROPOSED ProjectionPatch. The patch must
// pass the Compiler and the Constitution Gate before the Live Preview updates.
// This component holds UI state only; all governance lives in the engine.

import { useCallback, useMemo, useState } from "react";
import type { ConstitutionActor } from "@/lib/constitution";
import type {
  AcquisitionSession,
  BuilderRecommendation,
  CompilerEnv,
  CompilerResult,
  ConstitutionalValidationResult,
  EvidenceObject,
  ProjectionArtifact,
  ProjectionPatch,
  SessionAuthority,
  SourceKind,
  SourceObject,
  SourceRef,
} from "@/lib/projection-studio/contracts";
import {
  appendJournalEntry,
  applyPatch,
  bindAsEvidence,
  compilePatch,
  constitutionallyValidate,
  generateRecommendation,
  parseDsl,
  proposeProjectionPatch,
  searchSources,
  startAcquisitionSession,
} from "@/lib/projection-studio/engine";

interface Props {
  env: CompilerEnv;
  artifacts: ProjectionArtifact[];
  sessionAuthority: SessionAuthority;
  actor: ConstitutionActor;
  enterpriseId: string;
  initialArtifactId: string;
}

const SOURCES: { kind: SourceKind; code: string; label: string }[] = [
  { kind: "web", code: "WB", label: "Web" },
  { kind: "browser_tab", code: "BT", label: "Browser Tab" },
  { kind: "docs", code: "DC", label: "Docs" },
  { kind: "slack", code: "SL", label: "Slack" },
  { kind: "email", code: "EM", label: "Email" },
  { kind: "sharepoint", code: "SP", label: "SharePoint" },
  { kind: "github", code: "GH", label: "GitHub" },
  { kind: "api", code: "AP", label: "APIs" },
  { kind: "runtime_explorer", code: "RX", label: "Runtime Explorer" },
  { kind: "enterprise_graph", code: "EG", label: "Enterprise Graph" },
  { kind: "constitution", code: "CN", label: "Constitution" },
];

type DrawerTab = "compiler" | "patch" | "evidence" | "journal";
type CenterTab = "dsl" | "binder";

function synthAt(session: AcquisitionSession): string {
  return new Date(Date.parse(session.authority.issuedAt) + session.journalEntries.length * 1000).toISOString();
}

export function ProjectionStudio({ env, artifacts, sessionAuthority, actor, enterpriseId, initialArtifactId }: Props) {
  const [activeId, setActiveId] = useState(initialArtifactId);
  const activeArtifact = useMemo(() => artifacts.find((a) => a.id === activeId) ?? artifacts[0], [artifacts, activeId]);

  const [dslText, setDslText] = useState(activeArtifact?.dsl ?? "");
  const [previewDsl, setPreviewDsl] = useState(activeArtifact?.dsl ?? "");

  const [session, setSession] = useState<AcquisitionSession>(() =>
    startAcquisitionSession({
      mission: "Improve the Candidate create surface",
      targetArtifact: initialArtifactId,
      authority: sessionAuthority,
      at: sessionAuthority.issuedAt,
    }),
  );

  const [sourceKind, setSourceKind] = useState<SourceKind>("docs");
  const [query, setQuery] = useState("location");
  const [results, setResults] = useState<SourceRef[]>([]);

  const [recommendation, setRecommendation] = useState<BuilderRecommendation | null>(null);
  const [patch, setPatch] = useState<ProjectionPatch | null>(null);
  const [compiler, setCompiler] = useState<CompilerResult | null>(null);
  const [validation, setValidation] = useState<ConstitutionalValidationResult | null>(null);
  const [applied, setApplied] = useState(false);

  const [centerTab, setCenterTab] = useState<CenterTab>("dsl");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("compiler");
  const [notice, setNotice] = useState<string | null>(null);

  // ── Switch active artifact ───────────────────────────────────────────────
  const selectArtifact = useCallback(
    (artifactId: string) => {
      const art = artifacts.find((a) => a.id === artifactId);
      if (!art) return;
      setActiveId(artifactId);
      setDslText(art.dsl);
      setPreviewDsl(art.dsl);
      setRecommendation(null);
      setPatch(null);
      setCompiler(null);
      setValidation(null);
      setApplied(false);
      setNotice(null);
    },
    [artifacts],
  );

  // ── Governed acquisition actions ─────────────────────────────────────────
  const runSearch = useCallback(() => {
    const refs = searchSources(sourceKind, query);
    setResults(refs);
    setSession((s) => {
      const at = synthAt(s);
      const withSearch: AcquisitionSession = {
        ...s,
        searches: [...s.searches, { searchId: `q_${s.searches.length + 1}`, kind: sourceKind, query, resultRefs: refs.map((r) => r.sourceRefId), at }],
      };
      return appendJournalEntry(withSearch, { at, phase: "acquisition", kind: "search", summary: `Search ${sourceKind} "${query}" → ${refs.length} result(s)` });
    });
  }, [sourceKind, query]);

  const captureRef = useCallback((ref: SourceRef) => {
    setSession((s) => {
      const at = synthAt(s);
      const captured: SourceObject = {
        sourceObjectId: `so_${ref.sourceRefId}`,
        ref,
        capturedAt: at,
        rawContent: ref.snippet,
        normalized: false,
      };
      if (s.sources.some((x) => x.sourceObjectId === captured.sourceObjectId)) return s;
      const withSource: AcquisitionSession = { ...s, sources: [...s.sources, captured], captures: [...s.captures, captured.sourceObjectId] };
      return appendJournalEntry(withSource, { at, phase: "acquisition", kind: "capture", summary: `Captured "${ref.title}" from ${ref.kind}` });
    });
    setCenterTab("binder");
  }, []);

  const bindEvidence = useCallback((source: SourceObject) => {
    setSession((s) => {
      const ev = bindAsEvidence(source);
      if (s.evidence.some((x) => x.evidenceId === ev.evidenceId)) return s;
      const withEv: AcquisitionSession = { ...s, evidence: [...s.evidence, ev] };
      return appendJournalEntry(withEv, { at: synthAt(s), phase: "acquisition", kind: "bind_evidence", summary: `Bound evidence ${ev.evidenceId} (${(ev.confidence * 100).toFixed(0)}% conf)` });
    });
  }, []);

  const genRecommendation = useCallback(() => {
    const result = generateRecommendation(activeId, session.evidence);
    if ("error" in result) {
      setNotice(result.error);
      return;
    }
    setNotice(null);
    setRecommendation(result);
    setSession((s) => appendJournalEntry({ ...s, recommendations: [...s.recommendations, result] }, { at: synthAt(s), phase: "recommendation", kind: "generate_recommendation", summary: `Builder recommendation ${result.recommendationId} (cites ${result.evidenceRefs.length} evidence)` }));
  }, [activeId, session.evidence]);

  const proposePatch = useCallback(() => {
    if (!recommendation) return;
    const parsed = parseDsl(dslText);
    if (!parsed.ok) {
      setNotice(`Cannot propose patch: current DSL is invalid (${parsed.error}).`);
      return;
    }
    const p = proposeProjectionPatch({ recommendation, currentDef: parsed.def, evidence: session.evidence, author: actor.label ?? "Builder" });
    setPatch(p);
    setCompiler(null);
    setValidation(null);
    setApplied(false);
    setDrawerTab("patch");
    setNotice(null);
    setSession((s) => appendJournalEntry(s, { at: synthAt(s), phase: "patch", kind: "propose_patch", summary: `Proposed patch ${p.patchId} → ${p.affectedRegions.join(", ") || "no-op"}` }));
  }, [recommendation, dslText, session.evidence, actor.label]);

  const runCompile = useCallback(() => {
    if (!patch) return;
    const result = compilePatch(env, patch);
    setCompiler(result);
    setPatch((p) => (p ? { ...p, compilerStatus: result.status } : p));
    setValidation(null);
    setApplied(false);
    setDrawerTab("compiler");
    setSession((s) => appendJournalEntry(s, { at: synthAt(s), phase: "compile", kind: "compile", summary: `Compiler ${result.status}${result.errors.length ? ` — ${result.errors.length} error(s)` : ""}` }));
  }, [patch, env]);

  const runValidation = useCallback(() => {
    if (!patch || !compiler) return;
    const result = constitutionallyValidate({ patch, compiler, actor, enterpriseId, now: Date.parse(sessionAuthority.issuedAt) });
    setValidation(result);
    setPatch((p) => (p ? { ...p, constitutionStatus: result.status } : p));
    setApplied(false);
    setSession((s) => appendJournalEntry(s, { at: synthAt(s), phase: "validation", kind: "validate", summary: `Constitution ${result.status} — authority ${result.authorityId}` }));
  }, [patch, compiler, actor, enterpriseId, sessionAuthority.issuedAt]);

  const approveAndUpdate = useCallback(() => {
    if (!patch || !compiler || !validation) return;
    const armed: ProjectionPatch = { ...patch, compilerStatus: compiler.status, constitutionStatus: validation.status };
    const result = applyPatch(armed, compiler, validation);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const after = patch.diff.after;
    setPreviewDsl(after);
    setDslText(after);
    setApplied(true);
    setNotice(null);
    setSession((s) => appendJournalEntry({ ...s, acceptedPatches: [...s.acceptedPatches, patch.patchId] }, { at: synthAt(s), phase: "preview", kind: "preview_update", summary: `Preview updated from ${patch.patchId} (compiled ${compiler.compiledFingerprint})` }));
  }, [patch, compiler, validation]);

  const rejectPatch = useCallback(() => {
    if (!patch) return;
    setSession((s) => appendJournalEntry({ ...s, rejectedPatches: [...s.rejectedPatches, patch.patchId] }, { at: synthAt(s), phase: "patch", kind: "patch_reject", summary: `Rejected patch ${patch.patchId}` }));
    setPatch(null);
    setCompiler(null);
    setValidation(null);
    setApplied(false);
  }, [patch]);

  // ── Derived gate status ──────────────────────────────────────────────────
  const gate = useMemo(() => {
    if (!patch) return { label: "AWAITING PATCH", tone: "muted" as const };
    if (!compiler) return { label: "READY TO COMPILE", tone: "info" as const };
    if (!compiler.ok) return { label: "COMPILE FAILED", tone: "bad" as const };
    if (!validation) return { label: "AWAITING CONSTITUTION", tone: "info" as const };
    if (!validation.approved) return { label: "CONSTITUTION REJECTED", tone: "bad" as const };
    if (!applied) return { label: "APPROVED — READY", tone: "good" as const };
    return { label: "PREVIEW UPDATED", tone: "good" as const };
  }, [patch, compiler, validation, applied]);

  const previewDef = useMemo(() => {
    const parsed = parseDsl(previewDsl);
    return parsed.ok ? parsed.def : null;
  }, [previewDsl]);

  const capturedSources = session.sources;
  const boundIds = new Set(session.evidence.map((e) => e.contextRef.sourceObjectId));

  return (
    <div className="ps-root">
      <header className="ps-topbar">
        <div className="ps-brand">
          <span className="ps-mark">▦</span>
          <span className="ps-title">PROJECTION STUDIO</span>
          <span className="ps-sub">/ GOVERNED CONTEXT ACQUISITION</span>
        </div>
        <div className="ps-top-meta">
          <span className="ps-chip">SESSION {session.sessionId}</span>
          <span className={`ps-gate ps-gate-${gate.tone}`}>CONSTITUTION GATE · {gate.label}</span>
        </div>
      </header>

      <div className="ps-main">
        {/* LEFT RAIL — artifacts / versions */}
        <aside className="ps-rail ps-rail-left">
          <div className="ps-rail-h">ARTIFACTS</div>
          <ul className="ps-art-list">
            {artifacts.map((a) => (
              <li key={a.id}>
                <button className={`ps-art ${a.id === activeId ? "is-active" : ""}`} onClick={() => selectArtifact(a.id)}>
                  <span className="ps-art-surface">{a.surface.toUpperCase()}</span>
                  <span className="ps-art-title">{a.title}</span>
                  <span className="ps-art-id">{a.id}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="ps-rail-h">ACTIVE</div>
          <div className="ps-active-box">
            <div className="ps-kv"><span>OBJECT</span><b>{activeArtifact?.objectType}</b></div>
            <div className="ps-kv"><span>SURFACE</span><b>{activeArtifact?.surface}</b></div>
            <div className="ps-kv"><span>MODE</span><b>{activeArtifact?.mode}</b></div>
            <div className="ps-kv"><span>EVIDENCE</span><b>{session.evidence.length}</b></div>
            <div className="ps-kv"><span>ACCEPTED</span><b>{session.acceptedPatches.length}</b></div>
          </div>
        </aside>

        {/* CENTER — DSL editor / source binder */}
        <section className="ps-col ps-editor">
          <div className="ps-col-tabs">
            <button className={centerTab === "dsl" ? "is-active" : ""} onClick={() => setCenterTab("dsl")}>DEFINITION / DSL</button>
            <button className={centerTab === "binder" ? "is-active" : ""} onClick={() => setCenterTab("binder")}>
              SOURCE BINDER {capturedSources.length > 0 ? `(${capturedSources.length})` : ""}
            </button>
          </div>

          {centerTab === "dsl" ? (
            <>
              <textarea
                className="ps-dsl"
                value={dslText}
                spellCheck={false}
                onChange={(e) => setDslText(e.target.value)}
                aria-label="Projection Definition DSL"
              />
              <div className="ps-editor-foot">
                <span className="ps-note">{parseDsl(dslText).ok ? "DSL parses" : "DSL invalid — fix before proposing a patch"}</span>
                <button className="ps-btn" disabled={!recommendation} onClick={proposePatch}>PROPOSE PROJECTION PATCH →</button>
              </div>
            </>
          ) : (
            <div className="ps-binder">
              {capturedSources.length === 0 && <p className="ps-empty">No captured sources yet. Search a governed source and Capture a result to bind it as evidence.</p>}
              {capturedSources.map((src) => {
                const bound = boundIds.has(src.sourceObjectId);
                return (
                  <div key={src.sourceObjectId} className="ps-srccard">
                    <div className="ps-srccard-h">
                      <span className="ps-srctag">{src.ref.kind.toUpperCase()}</span>
                      <span className="ps-srctitle">{src.ref.title}</span>
                      <span className={`ps-pill ${bound ? "ps-pill-good" : "ps-pill-muted"}`}>{bound ? "BOUND" : "UNBOUND"}</span>
                    </div>
                    <p className="ps-srcsnip">{src.ref.snippet}</p>
                    <div className="ps-srccard-f">
                      <span className="ps-loc">{src.ref.locator}</span>
                      <button className="ps-btn ps-btn-sm" disabled={bound} onClick={() => bindEvidence(src)}>BIND AS EVIDENCE</button>
                    </div>
                  </div>
                );
              })}
              {capturedSources.length > 0 && (
                <button className="ps-btn ps-btn-wide" disabled={session.evidence.length === 0} onClick={genRecommendation}>
                  GENERATE BUILDER RECOMMENDATION
                </button>
              )}
            </div>
          )}
        </section>

        {/* CENTER-RIGHT — live preview */}
        <section className="ps-col ps-preview">
          <div className="ps-col-tabs ps-col-tabs-static">
            <span className="is-active">LIVE PREVIEW</span>
            <span className="ps-prev-note">compiled / validated output only</span>
          </div>
          <div className="ps-preview-body">
            {!previewDef ? (
              <p className="ps-empty">Preview unavailable — definition does not compile.</p>
            ) : (
              <PreviewSurface def={previewDef} />
            )}
          </div>
          <div className="ps-preview-foot">
            <span className={`ps-gate ps-gate-${gate.tone}`}>{gate.label}</span>
            {validation?.approved && !applied && (
              <button className="ps-btn ps-btn-cyan" onClick={approveAndUpdate}>APPROVE &amp; UPDATE PREVIEW</button>
            )}
          </div>
        </section>

        {/* RIGHT RAIL — context acquisition */}
        <aside className="ps-rail ps-rail-right">
          <div className="ps-rail-h">CONTEXT RUNTIME</div>
          <p className="ps-rail-blurb">Enterprise context acquisition. Sources never edit projections — they become evidence.</p>
          <div className="ps-rail-h">SOURCES</div>
          <div className="ps-source-grid">
            {SOURCES.map((s) => (
              <button key={s.kind} className={`ps-source ${sourceKind === s.kind ? "is-active" : ""}`} onClick={() => setSourceKind(s.kind)} title={s.label}>
                <span className="ps-source-code">{s.code}</span>
                <span className="ps-source-label">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="ps-rail-h">SEARCH</div>
          <div className="ps-search">
            <input className="ps-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="query…" aria-label="Context search query" />
            <button className="ps-btn ps-btn-sm" onClick={runSearch}>SEARCH</button>
          </div>
          <div className="ps-results">
            {results.length === 0 && <p className="ps-empty ps-empty-sm">No results. Run a search.</p>}
            {results.map((r) => (
              <div key={r.sourceRefId} className="ps-result">
                <div className="ps-result-h">
                  <span className="ps-srctag">{r.kind.toUpperCase()}</span>
                  <span className="ps-rel">{(r.relevance * 100).toFixed(0)}%</span>
                </div>
                <div className="ps-result-title">{r.title}</div>
                <p className="ps-result-snip">{r.snippet}</p>
                <button className="ps-btn ps-btn-sm ps-btn-block" onClick={() => captureRef(r)}>CAPTURE →</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* BOTTOM DRAWER — compiler / patch / evidence / journal */}
      <section className="ps-drawer">
        <div className="ps-drawer-tabs">
          <button className={drawerTab === "compiler" ? "is-active" : ""} onClick={() => setDrawerTab("compiler")}>COMPILER / CONSTITUTION</button>
          <button className={drawerTab === "patch" ? "is-active" : ""} onClick={() => setDrawerTab("patch")}>PATCH REVIEW {patch ? "(1)" : ""}</button>
          <button className={drawerTab === "evidence" ? "is-active" : ""} onClick={() => setDrawerTab("evidence")}>EVIDENCE ({session.evidence.length})</button>
          <button className={drawerTab === "journal" ? "is-active" : ""} onClick={() => setDrawerTab("journal")}>EXECUTION JOURNAL ({session.journalEntries.length})</button>
          {notice && <span className="ps-notice">{notice}</span>}
        </div>

        <div className="ps-drawer-body">
          {drawerTab === "compiler" && (
            <div className="ps-compile">
              <div className="ps-compile-col">
                <div className="ps-stage-h">COMPILER</div>
                {!patch ? (
                  <p className="ps-empty">Propose a patch to compile.</p>
                ) : (
                  <>
                    <button className="ps-btn ps-btn-sm" onClick={runCompile}>RUN COMPILER</button>
                    {compiler && (
                      <div className="ps-compile-out">
                        <span className={`ps-pill ${compiler.ok ? "ps-pill-good" : "ps-pill-bad"}`}>{compiler.status.toUpperCase()}</span>
                        {compiler.compiledFingerprint && <span className="ps-fp">fp {compiler.compiledFingerprint}</span>}
                        {compiler.errors.map((e, i) => (
                          <div key={i} className="ps-issue ps-issue-err">✕ [{e.code}] {e.message}{e.region ? ` (${e.region})` : ""}</div>
                        ))}
                        {compiler.warnings.map((w, i) => (
                          <div key={i} className="ps-issue ps-issue-warn">! [{w.code}] {w.message}</div>
                        ))}
                        {compiler.ok && compiler.errors.length === 0 && <div className="ps-issue ps-issue-ok">✓ Definition compiles — all field references declared.</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="ps-compile-col">
                <div className="ps-stage-h">CONSTITUTION GATE</div>
                {!compiler?.ok ? (
                  <p className="ps-empty">Compiler must pass before constitutional validation.</p>
                ) : (
                  <>
                    <button className="ps-btn ps-btn-sm" onClick={runValidation}>RUN CONSTITUTIONAL VALIDATION</button>
                    {validation && (
                      <div className="ps-compile-out">
                        <span className={`ps-pill ${validation.approved ? "ps-pill-good" : "ps-pill-bad"}`}>{validation.status.toUpperCase()}</span>
                        <div className="ps-kv2"><span>AUTHORITY</span><b>{validation.authorityId}</b></div>
                        <div className="ps-kv2"><span>DECISION</span><b>{validation.decisionId}</b></div>
                        <div className="ps-kv2"><span>GRANTED</span><b>{String(validation.granted)}</b></div>
                        <div className="ps-kv2"><span>SIGNATURE</span><b>{validation.signature.slice(0, 16)}…</b></div>
                        <p className="ps-reason">{validation.reason}</p>
                        {validation.capabilities.map((c) => <span key={c} className="ps-cap">{c}</span>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {drawerTab === "patch" && (
            <div className="ps-patch">
              {!patch ? (
                <p className="ps-empty">No patch proposed. Bind evidence → generate a recommendation → propose a patch.</p>
              ) : (
                <>
                  <div className="ps-patch-meta">
                    <span className="ps-pill ps-pill-muted">{patch.patchId}</span>
                    <span className="ps-patch-reason">{patch.reason}</span>
                    <span className="ps-patch-conf">conf {(patch.confidence * 100).toFixed(0)}%</span>
                    <span className="ps-patch-region">regions: {patch.affectedRegions.join(", ") || "—"}</span>
                    <span className="ps-patch-evi">evidence: {patch.evidenceRefs.length}</span>
                  </div>
                  <div className="ps-diff">
                    <div className="ps-diff-col">
                      <div className="ps-diff-h">CURRENT DSL</div>
                      <pre className="ps-pre">{patch.diff.before}</pre>
                    </div>
                    <div className="ps-diff-col">
                      <div className="ps-diff-h">PROPOSED DSL</div>
                      <pre className="ps-pre">
                        {patch.diff.hunks.length === 0
                          ? patch.diff.after
                          : patch.diff.hunks.map((h, i) => (
                              <span key={i} className={`ps-hunk ps-hunk-${h.kind}`}>{h.kind === "add" ? "+ " : h.kind === "remove" ? "- " : "  "}{h.text}{"\n"}</span>
                            ))}
                      </pre>
                    </div>
                  </div>
                  <div className="ps-patch-actions">
                    <button className="ps-btn ps-btn-sm" onClick={runCompile}>COMPILE</button>
                    <button className="ps-btn ps-btn-sm" disabled={!compiler?.ok} onClick={runValidation}>VALIDATE</button>
                    <button className="ps-btn ps-btn-sm ps-btn-cyan" disabled={!validation?.approved || applied} onClick={approveAndUpdate}>APPROVE &amp; UPDATE</button>
                    <button className="ps-btn ps-btn-sm ps-btn-ghost" onClick={rejectPatch}>REJECT</button>
                  </div>
                </>
              )}
            </div>
          )}

          {drawerTab === "evidence" && (
            <div className="ps-evi-grid">
              {session.evidence.length === 0 && <p className="ps-empty">No evidence bound yet.</p>}
              {session.evidence.map((e) => <EvidenceCard key={e.evidenceId} ev={e} />)}
            </div>
          )}

          {drawerTab === "journal" && (
            <div className="ps-journal">
              {[...session.journalEntries].reverse().map((j) => (
                <div key={j.seq} className="ps-jrow">
                  <span className="ps-jseq">#{j.seq}</span>
                  <span className={`ps-jphase ps-jphase-${j.phase}`}>{j.phase}</span>
                  <span className="ps-jkind">{j.kind}</span>
                  <span className="ps-jsum">{j.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <StudioStyles />
    </div>
  );
}

// ── Live Preview renderer (dependency-free, structural) ──────────────────────

function PreviewSurface({ def }: { def: import("@/lib/projection-runtime/contracts/projection-definition").ProjectionDefinition }) {
  return (
    <div className="ps-surface">
      <div className="ps-surface-h">
        <span className="ps-surface-badge">{def.surface}</span>
        <span className="ps-surface-badge ps-surface-badge-mode">{def.mode}</span>
        <span className="ps-surface-title">{def.title}</span>
      </div>
      {def.description && <p className="ps-surface-desc">{def.description}</p>}
      {def.layout?.map((s) => (
        <div key={s.id} className="ps-surface-section">
          <div className="ps-surface-section-h">{s.title ?? s.id}</div>
          <div className="ps-surface-fields">
            {s.fields.map((f) => (
              <span key={f} className="ps-field-chip">{f}</span>
            ))}
          </div>
        </div>
      ))}
      {def.display?.columns && (
        <div className="ps-surface-section">
          <div className="ps-surface-section-h">columns</div>
          <div className="ps-surface-fields">
            {def.display.columns.map((c) => <span key={c.field} className="ps-field-chip">{c.label ?? c.field}</span>)}
          </div>
        </div>
      )}
      {def.primaryIntent && <div className="ps-surface-intent">▸ {def.primaryIntent}</div>}
    </div>
  );
}

function EvidenceCard({ ev }: { ev: EvidenceObject }) {
  return (
    <div className="ps-evi">
      <div className="ps-evi-h">
        <span className="ps-srctag">{ev.sourceType.toUpperCase()}</span>
        <span className={`ps-pill ${ev.bindStatus === "bound" ? "ps-pill-good" : "ps-pill-muted"}`}>{ev.bindStatus.toUpperCase()}</span>
        <span className="ps-evi-conf">{(ev.confidence * 100).toFixed(0)}%</span>
      </div>
      <p className="ps-evi-claim">{ev.claim}</p>
      <div className="ps-evi-prov">{ev.provenance}</div>
      <div className="ps-evi-foot">
        <span>{ev.evidenceId}</span>
        <span>{ev.capturedAt.slice(0, 19).replace("T", " ")}</span>
      </div>
    </div>
  );
}

function StudioStyles() {
  return (
    <style>{`
.ps-root{--ps-bg:#0b0d0e;--ps-bg2:#15191b;--ps-panel:#101315;--ps-ink:#eef2f1;--ps-muted:#7e8987;--ps-line:rgba(255,255,255,0.12);--ps-cyan:#8fe6d9;--ps-cyandim:#2e6f68;--ps-bad:#e8806f;--ps-good:#8fe6d9;--ps-warn:#e6c46a;
  --ps-mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;--ps-disp:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
  position:fixed;inset:0;display:flex;flex-direction:column;background:var(--ps-bg);color:var(--ps-ink);font-family:var(--ps-disp);overflow:hidden;}
.ps-root *{box-sizing:border-box;}
.ps-root button{font-family:var(--ps-mono);cursor:pointer;}
.ps-topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--ps-line);flex:0 0 auto;}
.ps-brand{display:flex;align-items:baseline;gap:10px;}
.ps-mark{color:var(--ps-cyan);font-size:16px;}
.ps-title{font-weight:700;letter-spacing:0.06em;font-size:15px;}
.ps-sub,.ps-prev-note{font-family:var(--ps-mono);font-size:10px;color:var(--ps-muted);letter-spacing:0.08em;}
.ps-top-meta{display:flex;align-items:center;gap:10px;}
.ps-chip{font-family:var(--ps-mono);font-size:10px;color:var(--ps-muted);border:1px solid var(--ps-line);padding:3px 7px;border-radius:4px;}
.ps-gate{font-family:var(--ps-mono);font-size:10px;letter-spacing:0.06em;padding:4px 9px;border-radius:4px;border:1px solid var(--ps-line);}
.ps-gate-muted{color:var(--ps-muted);} .ps-gate-info{color:var(--ps-cyan);border-color:var(--ps-cyandim);}
.ps-gate-good{color:#0b0d0e;background:var(--ps-cyan);border-color:var(--ps-cyan);font-weight:700;} .ps-gate-bad{color:var(--ps-bad);border-color:var(--ps-bad);}
.ps-main{flex:1 1 auto;display:grid;grid-template-columns:210px minmax(280px,1fr) minmax(280px,1fr) 290px;min-height:0;}
.ps-rail,.ps-col{border-right:1px solid var(--ps-line);min-height:0;overflow-y:auto;}
.ps-rail{padding:12px;background:var(--ps-panel);}
.ps-rail-right{border-right:none;}
.ps-rail-h{font-family:var(--ps-mono);font-size:9px;letter-spacing:0.1em;color:var(--ps-muted);margin:14px 0 7px;}
.ps-rail-h:first-child{margin-top:0;}
.ps-rail-blurb{font-size:11px;color:var(--ps-muted);line-height:1.4;margin:0;}
.ps-art-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}
.ps-art{width:100%;text-align:left;background:transparent;border:1px solid var(--ps-line);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:2px;color:var(--ps-ink);}
.ps-art.is-active{border-color:var(--ps-cyan);background:rgba(143,230,217,0.06);}
.ps-art-surface{font-family:var(--ps-mono);font-size:8px;color:var(--ps-cyan);letter-spacing:0.08em;}
.ps-art-title{font-size:12px;}
.ps-art-id{font-family:var(--ps-mono);font-size:9px;color:var(--ps-muted);}
.ps-active-box{border:1px solid var(--ps-line);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:5px;}
.ps-kv{display:flex;justify-content:space-between;font-family:var(--ps-mono);font-size:10px;}
.ps-kv span{color:var(--ps-muted);} .ps-kv b{color:var(--ps-ink);}
.ps-col{display:flex;flex-direction:column;}
.ps-col-tabs{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--ps-line);padding:0 8px;flex:0 0 auto;}
.ps-col-tabs button,.ps-col-tabs span{background:transparent;border:none;color:var(--ps-muted);font-size:10px;letter-spacing:0.06em;padding:10px 8px;font-family:var(--ps-mono);}
.ps-col-tabs button.is-active,.ps-col-tabs span.is-active{color:var(--ps-cyan);box-shadow:inset 0 -2px 0 var(--ps-cyan);}
.ps-col-tabs-static{justify-content:space-between;}
.ps-dsl{flex:1 1 auto;width:100%;resize:none;background:var(--ps-bg);color:var(--ps-ink);border:none;padding:12px;font-family:var(--ps-mono);font-size:11px;line-height:1.5;outline:none;}
.ps-editor-foot,.ps-preview-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid var(--ps-line);}
.ps-note,.ps-empty,.ps-loc{font-family:var(--ps-mono);font-size:10px;color:var(--ps-muted);}
.ps-empty{padding:14px;line-height:1.5;} .ps-empty-sm{padding:6px;}
.ps-btn{background:var(--ps-bg2);color:var(--ps-ink);border:1px solid var(--ps-line);border-radius:5px;padding:7px 11px;font-size:10px;letter-spacing:0.05em;}
.ps-btn:hover:not(:disabled){border-color:var(--ps-cyan);}
.ps-btn:disabled{opacity:0.35;cursor:not-allowed;}
.ps-btn-sm{padding:5px 9px;} .ps-btn-block,.ps-btn-wide{width:100%;margin-top:6px;}
.ps-btn-cyan{background:var(--ps-cyan);color:#0b0d0e;border-color:var(--ps-cyan);font-weight:700;}
.ps-btn-ghost{background:transparent;}
.ps-binder{padding:10px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;}
.ps-srccard,.ps-result,.ps-evi,.ps-srccard{border:1px solid var(--ps-line);border-radius:6px;padding:9px;background:var(--ps-panel);}
.ps-srccard-h,.ps-result-h,.ps-evi-h{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.ps-srctag{font-family:var(--ps-mono);font-size:8px;letter-spacing:0.08em;color:var(--ps-cyan);border:1px solid var(--ps-cyandim);padding:2px 5px;border-radius:3px;}
.ps-srctitle,.ps-result-title{font-size:12px;flex:1;}
.ps-srcsnip,.ps-result-snip{font-size:11px;color:var(--ps-muted);line-height:1.4;margin:4px 0;}
.ps-srccard-f{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ps-pill{font-family:var(--ps-mono);font-size:8px;letter-spacing:0.06em;padding:2px 6px;border-radius:3px;border:1px solid var(--ps-line);}
.ps-pill-good{color:#0b0d0e;background:var(--ps-cyan);border-color:var(--ps-cyan);}
.ps-pill-bad{color:var(--ps-bad);border-color:var(--ps-bad);}
.ps-pill-muted{color:var(--ps-muted);}
.ps-preview-body{flex:1 1 auto;overflow-y:auto;padding:14px;}
.ps-surface{border:1px solid var(--ps-line);border-radius:8px;padding:16px;background:var(--ps-panel);}
.ps-surface-h{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.ps-surface-badge{font-family:var(--ps-mono);font-size:9px;color:var(--ps-cyan);border:1px solid var(--ps-cyandim);padding:2px 6px;border-radius:3px;}
.ps-surface-badge-mode{color:var(--ps-muted);border-color:var(--ps-line);}
.ps-surface-title{font-size:16px;font-weight:600;}
.ps-surface-desc{font-size:12px;color:var(--ps-muted);line-height:1.5;margin:0 0 12px;}
.ps-surface-section{margin-bottom:12px;}
.ps-surface-section-h{font-family:var(--ps-mono);font-size:9px;letter-spacing:0.1em;color:var(--ps-muted);margin-bottom:6px;text-transform:uppercase;}
.ps-surface-fields{display:flex;flex-wrap:wrap;gap:6px;}
.ps-field-chip{font-size:11px;border:1px solid var(--ps-line);border-radius:14px;padding:4px 11px;background:var(--ps-bg);}
.ps-surface-intent{font-family:var(--ps-mono);font-size:11px;color:var(--ps-cyan);margin-top:8px;}
.ps-source-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;}
.ps-source{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--ps-line);border-radius:5px;padding:6px;color:var(--ps-ink);}
.ps-source.is-active{border-color:var(--ps-cyan);background:rgba(143,230,217,0.06);}
.ps-source-code{font-family:var(--ps-mono);font-size:8px;color:var(--ps-cyan);border:1px solid var(--ps-cyandim);border-radius:3px;padding:2px 3px;}
.ps-source-label{font-size:9px;color:var(--ps-muted);}
.ps-search{display:flex;gap:5px;}
.ps-input{flex:1;background:var(--ps-bg);border:1px solid var(--ps-line);border-radius:5px;color:var(--ps-ink);padding:6px 8px;font-family:var(--ps-mono);font-size:11px;outline:none;}
.ps-input:focus{border-color:var(--ps-cyan);}
.ps-results{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
.ps-rel{font-family:var(--ps-mono);font-size:9px;color:var(--ps-cyan);margin-left:auto;}
.ps-drawer{flex:0 0 38%;max-height:38%;border-top:1px solid var(--ps-line);display:flex;flex-direction:column;background:var(--ps-panel);}
.ps-drawer-tabs{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--ps-line);padding:0 8px;flex:0 0 auto;}
.ps-drawer-tabs button{background:transparent;border:none;color:var(--ps-muted);font-size:10px;letter-spacing:0.05em;padding:9px 10px;font-family:var(--ps-mono);}
.ps-drawer-tabs button.is-active{color:var(--ps-cyan);box-shadow:inset 0 -2px 0 var(--ps-cyan);}
.ps-notice{font-family:var(--ps-mono);font-size:10px;color:var(--ps-bad);margin-left:auto;padding-right:6px;}
.ps-drawer-body{flex:1 1 auto;overflow-y:auto;padding:12px;}
.ps-compile{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.ps-stage-h{font-family:var(--ps-mono);font-size:10px;letter-spacing:0.08em;color:var(--ps-ink);margin-bottom:8px;}
.ps-compile-out{margin-top:8px;display:flex;flex-direction:column;gap:5px;}
.ps-fp{font-family:var(--ps-mono);font-size:9px;color:var(--ps-muted);}
.ps-issue{font-family:var(--ps-mono);font-size:10px;line-height:1.4;}
.ps-issue-err{color:var(--ps-bad);} .ps-issue-warn{color:var(--ps-warn);} .ps-issue-ok{color:var(--ps-cyan);}
.ps-kv2{display:flex;gap:8px;font-family:var(--ps-mono);font-size:10px;}
.ps-kv2 span{color:var(--ps-muted);min-width:72px;} .ps-kv2 b{color:var(--ps-ink);}
.ps-reason{font-size:11px;color:var(--ps-muted);line-height:1.4;margin:4px 0;}
.ps-cap{font-family:var(--ps-mono);font-size:8px;color:var(--ps-cyan);border:1px solid var(--ps-cyandim);border-radius:3px;padding:2px 5px;margin-right:4px;}
.ps-patch-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px;}
.ps-patch-reason{font-size:12px;} .ps-patch-conf,.ps-patch-region,.ps-patch-evi{font-family:var(--ps-mono);font-size:9px;color:var(--ps-muted);}
.ps-diff{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ps-diff-h{font-family:var(--ps-mono);font-size:9px;letter-spacing:0.08em;color:var(--ps-muted);margin-bottom:5px;}
.ps-pre{background:var(--ps-bg);border:1px solid var(--ps-line);border-radius:6px;padding:9px;font-family:var(--ps-mono);font-size:10px;line-height:1.45;overflow:auto;max-height:180px;margin:0;white-space:pre-wrap;}
.ps-hunk-add{color:var(--ps-cyan);} .ps-hunk-remove{color:var(--ps-bad);} .ps-hunk-context{color:var(--ps-muted);}
.ps-patch-actions{display:flex;gap:6px;margin-top:10px;}
.ps-evi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;}
.ps-evi-claim{font-size:11px;line-height:1.4;margin:4px 0;}
.ps-evi-prov{font-family:var(--ps-mono);font-size:9px;color:var(--ps-muted);line-height:1.4;}
.ps-evi-conf{font-family:var(--ps-mono);font-size:9px;color:var(--ps-cyan);margin-left:auto;}
.ps-evi-foot{display:flex;justify-content:space-between;font-family:var(--ps-mono);font-size:8px;color:var(--ps-muted);margin-top:6px;}
.ps-journal{display:flex;flex-direction:column;gap:3px;}
.ps-jrow{display:flex;align-items:center;gap:9px;font-family:var(--ps-mono);font-size:10px;padding:4px 6px;border-bottom:1px solid var(--ps-line);}
.ps-jseq{color:var(--ps-muted);min-width:28px;}
.ps-jphase{color:var(--ps-cyan);min-width:92px;letter-spacing:0.05em;}
.ps-jkind{color:var(--ps-muted);min-width:120px;}
.ps-jsum{color:var(--ps-ink);}
`}</style>
  );
}
