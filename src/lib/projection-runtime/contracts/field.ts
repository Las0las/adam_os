// Universal Projection Runtime — field metadata contracts.
//
// Field definitions are the atomic, surface-agnostic description of a single
// editable/displayable attribute of an enterprise object. They live in metadata
// (never in a React component) so the SAME field can be rendered into a modal,
// drawer, full page, grid column, calendar item, document block, or graph node
// without any component-specific code.

/** Rendering/semantic type of a field. The renderer maps each to a control. */
export type FieldType =
  | "text"
  | "email"
  | "textarea"
  | "select"
  | "number"
  | "date"
  | "boolean";

/** A single declarative field-level validation rule. Pure data so it is
 *  serializable across the server→client boundary and evaluable on both sides. */
export interface FieldValidationRule {
  kind: "required" | "minLength" | "maxLength" | "pattern" | "email";
  /** Numeric bound for min/max length, or regex source for `pattern`. */
  value?: number | string;
  /** Human-readable violation message. */
  message: string;
}

/** Where a field binds onto the canonical object instance. The BindingEngine
 *  uses this both to read initial values (edit/view) and to assemble the intent
 *  payload (create/update). */
export interface FieldBinding {
  /** `title`/`status` map to the canonical top-level columns; `property` maps to
   *  a key inside the object's `properties` bag (the default). */
  target: "title" | "status" | "property";
  /** Property key when target === "property". Defaults to the field key. */
  path?: string;
}

/** A selectable option for `select` fields. */
export interface FieldOption {
  value: string;
  label: string;
}

/** The canonical, surface-agnostic definition of one field. */
export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  binding: FieldBinding;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  defaultValue?: unknown;
  validations?: FieldValidationRule[];
  /** Default visibility/editability; the runtime may further restrict via
   *  permissions/policy/mode. */
  readOnly?: boolean;
}
