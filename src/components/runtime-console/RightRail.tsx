"use client";

import { Icon, type IconName } from "./icons";
import {
  LIVE_ACTIVITY,
  PLAN_DETAIL,
  RUNTIME_INSIGHTS,
  type InsightMetric,
} from "@/lib/runtime-console/data";

function Sparkline({ points, tone }: { points: readonly number[]; tone: string }) {
  const w = 96;
  const h = 26;
  const stroke =
    tone === "good" ? "#3ecf8e" : tone === "bad" ? "#ff6b6b" : tone === "warn" ? "#f5b544" : "#44b0b1";
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - 3 - p * (h - 6)).toFixed(1)}`)
    .join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  const gid = `sg-${tone}`;
  return (
    <svg className="eor-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightRow({ m }: { m: InsightMetric }) {
  return (
    <div className="eor-insight">
      <span className="eor-insight-label">{m.label}</span>
      <span className={`eor-insight-val t-${m.tone}`}>{m.value}</span>
      <Sparkline points={m.spark} tone={m.tone} />
    </div>
  );
}

export function RightRail() {
  return (
    <aside className="eor-col eor-rail-right">
      {/* Execution Plan Detail */}
      <section className="glass eor-detail">
        <h4 className="section-label">Execution Plan Detail</h4>
        {PLAN_DETAIL.map((step, i) => {
          const last = i === PLAN_DETAIL.length - 1;
          return (
            <div className="eor-step" key={step.title}>
              <div className="eor-step-rail">
                <span className="eor-step-node">
                  <Icon name="check" size={12} />
                </span>
                {!last && <span className="eor-step-conn" />}
              </div>
              <div className="eor-step-body">
                <div className="eor-step-title">{step.title}</div>
                {step.lines.map((l) => (
                  <div className="eor-step-line" key={l}>
                    {l}
                  </div>
                ))}
                {step.bullets && (
                  <ul className="eor-step-bullets">
                    {step.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {typeof step.confidence === "number" && (
                  <div className="eor-conf-bar">
                    <div className="eor-conf-fill" style={{ width: `${step.confidence}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Runtime Insights */}
      <section className="glass eor-detail">
        <h4 className="section-label">Runtime Insights</h4>
        {RUNTIME_INSIGHTS.map((m) => (
          <InsightRow key={m.label} m={m} />
        ))}
        <button className="eor-link" type="button">
          View all runtimes <Icon name="arrow" size={13} />
        </button>
      </section>

      {/* Live Activity */}
      <section className="glass eor-detail">
        <h4 className="section-label">Live Activity</h4>
        {LIVE_ACTIVITY.map((a) => (
          <div className="eor-act" key={a.id}>
            <span className={`eor-act-ico chip ${a.tone}`} style={{ padding: 0 }}>
              <Icon name={a.icon as IconName} size={13} />
            </span>
            <div className="eor-act-body">
              <div className="eor-act-label">{a.label}</div>
              <div className="eor-act-ago">{a.ago}</div>
            </div>
          </div>
        ))}
        <button className="eor-link" type="button">
          View all activity <Icon name="arrow" size={13} />
        </button>
      </section>
    </aside>
  );
}
