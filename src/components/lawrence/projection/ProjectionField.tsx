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
  const common = {
    id,
    className: "pf-control",
    disabled: !field.editable,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-err` : undefined,
  };

  return (
    <div className="pf-field">
      <label className="pf-label" htmlFor={id}>
        {field.label}
        {field.required ? <span className="pf-req"> *</span> : null}
      </label>

      {field.type === "textarea" ? (
        <textarea
          {...common}
          rows={3}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          {...common}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <input
          {...common}
          type="checkbox"
          className="pf-checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
      ) : (
        <input
          {...common}
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}

      {error ? (
        <p id={`${id}-err`} className="pf-error">
          {error}
        </p>
      ) : field.helpText ? (
        <p className="pf-help">{field.helpText}</p>
      ) : null}
    </div>
  );
}
