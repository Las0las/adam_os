"use client";

import { useEffect } from "react";
import type { ExecuteResult } from "./useExecuteAction";

const TONE: Record<string, string> = {
  completed: "good",
  awaiting_approval: "warn",
  awaiting_review: "warn",
  failed: "bad",
};

const MESSAGE: Record<string, string> = {
  completed: "Action completed.",
  awaiting_approval: "Submitted — awaiting approval (review case opened).",
  awaiting_review: "Submitted — awaiting review.",
  failed: "Action failed.",
};

export function ActionResultToast({ result, onClose }: { result: ExecuteResult; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const tone = TONE[result.state] ?? "warn";
  return (
    <div className={`toast ${tone}`} role="status" onClick={onClose}>
      <strong>{MESSAGE[result.state] ?? result.state}</strong>
      {result.message ? <div className="muted">{result.message}</div> : null}
    </div>
  );
}
