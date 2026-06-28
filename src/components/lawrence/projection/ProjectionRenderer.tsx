"use client";

// ProjectionRenderer — the universal form renderer. It consumes a serializable
// RenderPlan and renders it identically whether the surface chrome is a modal, a
// drawer, or a full page. It contains NO domain logic: validation comes from the
// plan (ValidationEngine), submission emits a governed intent (IntentEmitter),
// and follow-ups come from the plan's resolved post-actions. Swapping the object
// behind the plan changes the form with zero code change here.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RenderPlan, ResolvedIntent } from "@/lib/projection-runtime/contracts/universal-projection";
import { validateValues } from "@/lib/projection-runtime/engines/validation-engine";
import { emitIntent } from "@/lib/projection-runtime/intents/intent-emitter";

type Values = Record<string, unknown>;
type Errors = Record<string, string>;

function initialValues(plan: RenderPlan): Values {
  const values: Values = {};
  for (const section of plan.sections) {
    for (const field of section.fields) values[field.key] = field.value ?? "";
  }
  return values;
}

const STATE_TONE: Record<string, "good" | "bad" | "warn"> = {
  completed: "good",
  failed: "bad",
  blocked: "bad",
  awaiting_approval: "warn",
  awaiting_review: "warn",
};

const STATE_MESSAGE: Record<string, string> = {
  completed: "Done.",
  failed: "The intent failed.",
  blocked: "The intent was blocked by governance.",
  awaiting_approval: "Submitted — awaiting approval.",
  awaiting_review: "Submitted — awaiting review.",
};

export function ProjectionRenderer({
  plan,
  onClose,
  onSettled,
}: {
  plan: RenderPlan;
  onClose?: () => void;
  onSettled?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(plan));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "good" | "bad" | "warn"; message: string } | null>(null);

  const allFields = useMemo(() => plan.sections.flatMap((s) => s.fields), [plan]);

  const setField = (key: string, value: unknown): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const primary = plan.primaryIntent;

  async function submit(intent: ResolvedIntent): Promise<void> {
    if (!intent.enabled) return;
    // Declarative validation from the plan (same engine the server re-runs).
    const validation = validateValues(allFields, plan.objectValidations, values);
    if (!validation.ok) {
      const next: Errors = {};
      for (const v of validation.violations) if (!next[v.field]) next[v.field] = v.message;
      setErrors(next);
      setResult({ tone: "bad", message: validation.violations[0]?.message ?? "Please fix the highlighted fields." });
      return;
    }

    setSubmitting(true);
    setResult(null);
    const emission = await emitIntent(intent, values);
    setSubmitting(false);

    const tone = STATE_TONE[emission.state] ?? "warn";
    setResult({ tone, message: emission.message ?? STATE_MESSAGE[emission.state] ?? "Submitted." });

    if (emission.state === "completed") {
      // Run the plan's declarative post-actions.
      for (const post of plan.postActions) {
        if (post.forOperations && !post.forOperations.includes(intent.operation)) continue;
        if (post.kind === "navigate" && post.href && emission.resultId) {
          const href = post.href
            .replace("{id}", emission.resultId)
            .replace("{objectType}", plan.objectType);
          onSettled?.();
          router.push(href);
          return;
        }
      }
      onSettled?.();
    }
  }

  return (
    <form
      className="proj-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (primary) void submit(primary);
      }}
    >
      {plan.sections.map((section) => (
        <fieldset key={section.id} className="proj-section" disabled={submitting}>
          {section.title ? <legend className="proj-section-title">{section.title}</legend> : null}
          {section.description ? <p className="muted proj-section-desc">{section.description}</p> : null}
          <div className={section.columns === 2 ? "proj-grid-2" : "proj-grid-1"}>
            {section.fields.map((field) => (
              <ProjectionFieldSlot
                key={field.key}
                field={field}
                value={values[field.key]}
                error={errors[field.key]}
                onChange={setField}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {result ? <div className={`proj-result ${result.tone}`}>{result.message}</div> : null}

      <div className="proj-actions">
        {onClose ? (
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        ) : null}
        <div className="spacer" />
        {plan.secondaryIntents.map((intent) => (
          <button
            key={intent.name}
            type="button"
            className={`btn btn-${intent.variant}`}
            disabled={!intent.enabled || submitting}
            title={intent.disabledReason ?? undefined}
            onClick={() => void submit(intent)}
          >
            {intent.label}
          </button>
        ))}
        {primary ? (
          <button
            type="submit"
            className={`btn btn-${primary.variant}`}
            disabled={!primary.enabled || submitting}
            title={primary.disabledReason ?? undefined}
          >
            {submitting ? "…" : primary.requiresApproval ? `${primary.label} (approval)` : primary.label}
          </button>
        ) : null}
      </div>
    </form>
  );
}

// Local slot wrapper so the field component import stays colocated.
import { ProjectionField } from "./ProjectionField";
function ProjectionFieldSlot(props: React.ComponentProps<typeof ProjectionField>) {
  return <ProjectionField {...props} />;
}
