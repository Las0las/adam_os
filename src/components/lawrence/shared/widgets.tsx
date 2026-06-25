// Small presentational helpers shared across dashboards.

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card metric">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1 className="page-title">{title}</h1>
      {sub ? <p className="page-sub">{sub}</p> : null}
    </header>
  );
}

const TONE: Record<string, string> = {
  open: "warn",
  in_review: "warn",
  blocked: "bad",
  failed: "bad",
  rejected: "bad",
  completed: "good",
  approved: "good",
  resolved: "good",
  sent: "good",
  deployed: "good",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status] ?? "neutral";
  return <span className={`badge ${tone}`}>{status}</span>;
}
