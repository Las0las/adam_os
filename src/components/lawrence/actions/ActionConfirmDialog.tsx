"use client";

export function ActionConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="drawer-overlay" onClick={onCancel} />
      <div
        className="drawer"
        style={{ width: "min(420px, 92vw)", height: "auto", top: "30vh", right: "auto", left: "50%", transform: "translateX(-50%)", borderRadius: 10, border: "1px solid var(--border)" }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p className="muted">{message}</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
