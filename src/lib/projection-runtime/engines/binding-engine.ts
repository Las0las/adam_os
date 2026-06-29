// BindingEngine — binds a canonical object instance (or defaults, for create)
// onto field metadata, and inverts a submitted values map back into a canonical
// upsert payload. This is the only place that knows how a field's value maps to
// the canonical object's title/status/properties, keeping that knowledge out of
// both the renderer and the action handler's hand-rolled shaping.

import type { FieldDefinition, FieldBinding } from "../contracts/field";
import type { EnterpriseObjectDefinition } from "../contracts/enterprise-object";
import type { ObjectInstanceSnapshot } from "../contracts/context";
import type { ProjectionMode } from "../contracts/projection-definition";

/** Resolve the effective binding path (defaults to the field key). */
export function bindingPath(binding: FieldBinding, fieldKey: string): string {
  return binding.path ?? fieldKey;
}

/** Read the bound initial value for a field from an instance (edit/view) or its
 *  default (create). Returns "" when nothing is bound so controls stay controlled. */
export function readFieldValue(
  field: FieldDefinition,
  instance: ObjectInstanceSnapshot | null | undefined,
  mode: ProjectionMode,
): unknown {
  if (mode === "create" || !instance) {
    return field.defaultValue ?? defaultForType(field);
  }
  const { target } = field.binding;
  if (target === "title") return instance.title ?? "";
  if (target === "status") return instance.status ?? "";
  const path = bindingPath(field.binding, field.key);
  const props = instance.properties ?? {};
  return props[path] ?? field.defaultValue ?? defaultForType(field);
}

function defaultForType(field: FieldDefinition): unknown {
  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return "";
    default:
      return "";
  }
}

/** The canonical upsert payload the action handler persists. Mirrors the shape
 *  expected by `upsertObject` so the handler stays a thin governance wrapper. */
export interface CanonicalUpsertPayload {
  objectType: string;
  title: string | null;
  status: string | null;
  properties: Record<string, unknown>;
}

/**
 * Invert a submitted values map into a canonical payload using the object's
 * field bindings. Title falls back to the configured titleField, then to any
 * `title`-bound field, then to null. This is shared by client (optimistic) and
 * server (authoritative) so the mapping can never drift.
 */
export function toCanonicalPayload(
  object: EnterpriseObjectDefinition,
  values: Record<string, unknown>,
): CanonicalUpsertPayload {
  let title: string | null = null;
  let status: string | null = null;
  const properties: Record<string, unknown> = {};

  for (const field of object.fields) {
    const raw = values[field.key];
    const value = normalizeForType(field, raw);
    if (value === undefined) continue;
    if (field.binding.target === "title") {
      if (value != null && String(value).length > 0) title = String(value);
      continue;
    }
    if (field.binding.target === "status") {
      if (value != null && String(value).length > 0) status = String(value);
      continue;
    }
    properties[bindingPath(field.binding, field.key)] = value;
  }

  if (!title && object.titleField) {
    const tv = values[object.titleField];
    if (tv != null && String(tv).length > 0) title = String(tv);
  }

  return { objectType: object.objectType, title, status, properties };
}

function normalizeForType(field: FieldDefinition, raw: unknown): unknown {
  if (raw === undefined) return undefined;
  if (field.type === "number") {
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (field.type === "boolean") return Boolean(raw);
  return raw;
}
