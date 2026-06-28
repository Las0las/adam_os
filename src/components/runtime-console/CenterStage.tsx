"use client";

import { Icon, type IconName } from "./icons";
import {
  ContextZone,
  GovernedActionBar,
  IntentPreview,
  useClipboard,
  type Decision,
  type MenuItem,
  type Outcome,
} from "./lis";
import {
  ACTION_INTENT,
  CAPABILITIES,
  CAPABILITY_INTENT,
  GOVERNANCE_CHECKS,
  OBJECT_INTENT,
  objectCopyPayload,
  objectLink,
  PIPELINE,
  PROMPT_TEXT,
  RECOMMENDED_ACTIONS,
  RUN_STATS,
  RUNTIME_STATUS,
  SELECTED_OBJECTS,
} from "@/lib/runtime-console/data";

/** Build the universal copy/open/pin menu for any object surface. */
function useObjectMenu(
  onOpenObject: (id: string) => void,
  onToast: (msg: string) => void,
) {
  const copy = useClipboard();
  return (o: { id: string; name: string; kind: string }): MenuItem[] => [
    {
      id: `${o.id}-link`,
      label: "Copy link",
      icon: "link",
      kbd: "⌘L",
      flashOnRun: true,
      run: () => copy(objectLink(o.id)),
    },
    {
      id: `${o.id}-json`,
      label: "Copy as JSON",
      icon: "code",
      flashOnRun: true,
      run: () => copy(objectCopyPayload(o.id, o.name, o.kind)),
    },
    {
      id: `${o.id}-id`,
      label: "Copy object ID",
      icon: "hash",
      flashOnRun: true,
      run: () => copy(o.id),
    },
    { id: `${o.id}-sep`, label: "", icon: "link", sep: true, run: () => false },
    {
      id: `${o.id}-open`,
      label: "Open in Workspace",
      icon: "open",
      run: () => {
        onOpenObject(o.id);
        return false;
      },
    },
    {
      id: `${o.id}-pin`,
      label: "Pin to workspace",
      icon: "pin",
      run: () => {
        onToast(`${o.name} pinned to workspace`);
        return false;
      },
    },
  ];
}

function RuntimeCube() {
  return (
    <div className="eor-cube-wrap">
      <div className="eor-cube">
        <span className="face f1" />
        <span className="face f2" />
        <span className="face f3" />
        <span className="face f4" />
        <span className="face f5" />
        <span className="face f6" />
        <span className="eor-cube-core" />
      </div>
    </div>
  );
}

export function CenterStage({
  activeIndex,
  doneThrough,
  executing,
  onExecute,
  onOpenObject,
  onToast,
}: {
  activeIndex: number;
  doneThrough: number;
  executing: boolean;
  onExecute: () => void;
  onOpenObject: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const buildMenu = useObjectMenu(onOpenObject, onToast);
  const settleToast = (name: string) => (decision: Decision, outcome: Outcome) => {
    const verb =
      outcome === "escalated"
        ? "escalated to a human"
        : decision === "dismiss"
          ? "dismissed"
          : "approved";
    onToast(`${name} — ${verb} · governed event appended`);
  };
  return (
    <div className="eor-col">
      {/* ── Outcome prompt ─────────────────────────────────────────────── */}
      <section className="glass eor-prompt">
        <div className="eor-prompt-label section-label">What outcome are you trying to achieve?</div>
        <h2 className="eor-prompt-text">{PROMPT_TEXT}</h2>
        <div className="eor-prompt-row">
          {SELECTED_OBJECTS.map((o) => {
            const chip = (
              <button
                type="button"
                className="eor-objchip lis-intent lis-focusable"
                onClick={() => onOpenObject(o.id)}
              >
                <span className="eor-objchip-ico">
                  <Icon name={o.icon} size={16} />
                </span>
                <span>
                  <span className="eor-objchip-name">{o.name}</span>
                  <br />
                  <span className="eor-objchip-kind">{o.kind}</span>
                </span>
                <span className="chev">
                  <Icon name="chevron" size={14} />
                </span>
              </button>
            );
            const meta = OBJECT_INTENT[o.id];
            return (
              <ContextZone key={o.id} items={buildMenu(o)}>
                {meta ? <IntentPreview meta={meta}>{chip}</IntentPreview> : chip}
              </ContextZone>
            );
          })}
          <button type="button" className="eor-addobj">
            <Icon name="plus" size={14} /> Add Object
          </button>
          <span className="eor-prompt-spacer" />
          <button type="button" className="eor-mic" aria-label="Voice input">
            <Icon name="mic" size={18} />
          </button>
          <button type="button" className="eor-send" aria-label="Run prompt" onClick={onExecute}>
            <Icon name="send" size={20} />
          </button>
        </div>
        <div className="eor-hints">
          <span className="eor-hint">
            <b>@</b> to reference objects
          </span>
          <span className="eor-hint">
            <b>/</b> for actions
          </span>
          <span className="eor-hint">Natural language works</span>
        </div>
      </section>

      {/* ── Execution plan pipeline ────────────────────────────────────── */}
      <section className="glass eor-plan">
        <div className="eor-plan-head">
          <span className="section-label">Execution Plan</span>
          <span className="note">(Preview before execution)</span>
        </div>
        <div className="eor-pipe">
          {PIPELINE.map((stage, i) => {
            const done = i < doneThrough;
            const active = i === activeIndex;
            return (
              <div key={stage.key} style={{ display: "contents" }}>
                <div className={`eor-stage${active ? " active" : ""}${done ? " done" : ""}`}>
                  <div className="eor-stage-top">
                    <span className="eor-stage-ico">
                      <Icon name={done ? "check" : (stage.icon as IconName)} size={15} />
                    </span>
                    <span className="eor-stage-title">{stage.title}</span>
                  </div>
                  <div className="eor-stage-detail">{stage.detail}</div>
                  {stage.status && (
                    <span className={`eor-stage-status t-${stage.statusTone ?? "muted"}`}>
                      <span className={`dot ${stage.statusTone ?? "muted"}`} />
                      {stage.status}
                    </span>
                  )}
                </div>
                {i < PIPELINE.length - 1 && (
                  <span className="eor-pipe-arrow">
                    <Icon name="arrow" size={15} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Runtime · Capabilities · Governance ────────────────────────── */}
      <div className="eor-tri">
        <section className="glass eor-card">
          <div className="eor-card-h">
            <Icon name="runtime" size={16} className="t-accent" />
            <h4 className="section-label">Runtime Status</h4>
          </div>
          <RuntimeCube />
          <div className="eor-status-lines">
            {RUNTIME_STATUS.map((l) => (
              <div className="eor-status-line" key={l.label}>
                <span className={`dot ${l.tone}`} />
                <span className={l.tone === "muted" ? "t-muted" : ""}>{l.label}</span>
              </div>
            ))}
          </div>
          <button className="eor-link" type="button" style={{ marginTop: 12 }}>
            View Runtime Details <Icon name="arrow" size={13} />
          </button>
        </section>

        <section className="glass eor-card">
          <div className="eor-card-h">
            <Icon name="capabilities" size={16} className="t-accent" />
            <h4 className="section-label">Capabilities to Execute</h4>
          </div>
          {CAPABILITIES.map((c) => {
            const meta = CAPABILITY_INTENT[c.id];
            const row = (
              <div className="eor-capi lis-intent" key={c.id}>
                <span className="eor-capi-ico">
                  <Icon name={c.icon} size={16} />
                </span>
                <span className="eor-capi-body">
                  <span className="eor-capi-title">{c.title}</span>
                  <br />
                  <span className="eor-capi-desc">{c.desc}</span>
                </span>
                <button className="eor-read lis-focusable" type="button">
                  Read
                </button>
              </div>
            );
            return meta ? (
              <IntentPreview key={c.id} meta={meta}>
                {row}
              </IntentPreview>
            ) : (
              row
            );
          })}
        </section>

        <section className="glass eor-card">
          <div className="eor-card-h">
            <Icon name="shield" size={16} className="t-accent" />
            <h4 className="section-label">Governance &amp; Policy Check</h4>
          </div>
          {GOVERNANCE_CHECKS.map((g) => (
            <div className="eor-gov-row" key={g.label}>
              <span className="eor-gov-ico">
                <Icon name="check" size={14} />
              </span>
              <span className="eor-gov-label">{g.label}</span>
              <span className={`eor-gov-val ${g.tone ? `t-${g.tone}` : ""}`}>
                {g.value}
                {g.check && <Icon name="check" size={13} />}
              </span>
            </div>
          ))}
          <div className="eor-gov-pass">
            <Icon name="check" size={14} /> All checks passed
          </div>
        </section>
      </div>

      {/* ── Run strip ──────────────────────────────────────────────────── */}
      <section className="glass eor-strip">
        {RUN_STATS.map((s) => (
          <div className="eor-runstat" key={s.label}>
            <span className="eor-runstat-ico">
              <Icon name={s.icon} size={17} />
            </span>
            <span>
              <span className="eor-runstat-label">{s.label}</span>
              <br />
              <span className="eor-runstat-val">{s.value}</span>
            </span>
          </div>
        ))}
        <span className="eor-strip-spacer" />
        <button className="eor-execute" type="button" onClick={onExecute} disabled={executing}>
          {executing ? (
            <>Executing…</>
          ) : (
            <>
              <Icon name="play" size={16} /> Execute
            </>
          )}
        </button>
      </section>

      {/* ── Recommended next actions ───────────────────────────────────── */}
      <section className="glass eor-rec">
        <div className="eor-rec-head">
          <span className="section-label">Recommended Next Actions</span>
          <span className="note">(Context-Aware)</span>
        </div>
        <div className="eor-rec-grid">
          {RECOMMENDED_ACTIONS.map((a) => {
            const meta = ACTION_INTENT[a.id];
            const card = (
              <div className="eor-rec-card lis-intent">
                <div className="eor-rec-top">
                  <span className={`eor-rec-ico chip ${a.tone}`} style={{ padding: 0 }}>
                    <Icon name={a.icon as IconName} size={16} />
                  </span>
                  {a.badge && <span className={`eor-rec-badge t-${a.tone}`}>{a.badge}</span>}
                </div>
                <div className="eor-rec-title">{a.title}</div>
                <div className="eor-rec-desc">{a.desc}</div>
                <GovernedActionBar
                  approveLabel={a.cta}
                  compact
                  onSettled={settleToast(a.title)}
                  onReverted={() => onToast(`${a.title} — reverted`)}
                />
              </div>
            );
            return (
              <ContextZone
                key={a.id}
                items={buildMenu({ id: a.id, name: a.title, kind: "Recommended action" })}
              >
                {meta ? <IntentPreview meta={meta}>{card}</IntentPreview> : card}
              </ContextZone>
            );
          })}
          <div className="eor-rec-card eor-rec-viewall">
            <Icon name="plus" size={18} />
            <b>View all</b>
            <span className="eor-rec-desc" style={{ textAlign: "center" }}>
              12 actions
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
