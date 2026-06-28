"use client";

// Renders a single ResolvedField from a render plan. It is entirely driven by
// field metadata — there is no field-specific or object-specific code here. Adding
// a new field type is the only reason this component ever changes.

import type { ResolvedField } from "@/lib/projection-runtime/contracts/universal-projection";

export function ProjectionField({
  field,
  value,
  error,
  onChange,
}: {
  field: ResolvedField;
  value: unknown;
  error?: string;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = `pf-${field.key}`;
  const invalid = Boolean(error);
  const describedBy = error ? `${id}-err` : field.helpText ? `${id}-help` : undefined;

  const control = (() => {
    if (field.type === "textarea") {
      return (
        <textarea
          id={id}
          className={`proj-textarea${invalid ? " invalid" : ""}`}
          disabled={!field.editable}
          rows={3}
          placeholder={field.placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      );
    }
    if (field.type === "select") {
      return (
        <select
          id={id}
          className={`proj-select${invalid ? " invalid" : ""}`}
          disabled={!field.editable}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        id={id}
        className={`proj-input${invalid ? " invalid" : ""}`}
        type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        disabled={!field.editable}
        placeholder={field.placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    );
  })();

  // Boolean renders the label inline with the checkbox.
  if (field.type === "boolean") {
    return (
      <div className="proj-field">
        <label className="proj-checkbox" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            disabled={!field.editable}
            checked={Boolean(value)}
            onChange={(e) => onChange(field.key, e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? <span className="req">*</span> : null}
          </span>
        </label>
        {error ? (
          <p id={`${id}-err`} className="proj-error">
            {error}
          </p>
        ) : field.helpText ? (
          <p id={`${id}-help`} className="proj-help">
            {field.helpText}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="proj-field">
      <label className="proj-label" htmlFor={id}>
        {field.label}
        {field.required ? <span className="req">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={`${id}-err`} className="proj-error">
          {error}
        </p>
      ) : field.helpText ? (
        <p id={`${id}-help`} className="proj-help">
          {field.helpText}
        </p>
      ) : null}
    </div>
  );
}
