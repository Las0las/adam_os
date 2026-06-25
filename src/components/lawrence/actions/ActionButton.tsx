"use client";

// Phase 5 — governed action button (Part D). Danger/approval actions confirm
// first; all execution routes through useExecuteAction (Mission Control action
// engine, function runtime, or review resolve). Shows the real backend state.

import { useState } from "react";
import type { CommandActionRef } from "@/lib/domains/command-center/command-center-types";
import { useExecuteAction, type ActionContext, type ExecuteResult } from "./useExecuteAction";
import { ActionConfirmDialog } from "./ActionConfirmDialog";
import { ActionResultToast } from "./ActionResultToast";

const VARIANT_CLASS: Record<CommandActionRef["variant"], string> = {
  primary: "btn btn-primary",
  secondary: "btn",
  danger: "btn btn-danger",
  ghost: "btn btn-ghost",
};

export function ActionButton({
  action,
  context,
  onSettled,
}: {
  action: CommandActionRef;
  context: ActionContext;
  onSettled?: () => void;
}) {
  const { state, result, execute, reset } = useExecuteAction(onSettled);
  const [confirming, setConfirming] = useState(false);
  const needsConfirm = action.variant === "danger" || action.requiresApproval;

  const run = async (): Promise<void> => {
    setConfirming(false);
    await execute(action, context);
  };

  const label = state === "executing" ? "…" : action.label;

  return (
    <>
      <button
        className={VARIANT_CLASS[action.variant]}
        disabled={action.disabled || state === "executing"}
        title={action.disabledReason ?? undefined}
        onClick={() => (needsConfirm ? setConfirming(true) : run())}
      >
        {label}
      </button>

      {confirming ? (
        <ActionConfirmDialog
          title={action.label}
          message={
            action.requiresApproval
              ? "This action requires approval and will open a review case."
              : "This action cannot be easily undone. Continue?"
          }
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      {result && state !== "idle" && state !== "executing" ? (
        <ActionResultToast result={result as ExecuteResult} onClose={reset} />
      ) : null}
    </>
  );
}
