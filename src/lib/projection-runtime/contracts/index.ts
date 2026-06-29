// Universal Projection Runtime — contract barrel.

export type {
  FieldType,
  FieldValidationRule,
  FieldBinding,
  FieldOption,
  FieldDefinition,
} from "./field";

export type {
  ObjectValidationRule,
  LifecycleState,
  LifecycleTransition,
  LifecycleDefinition,
  IntentOperation,
  IntentDefinition,
  PostActionDefinition,
  EnterpriseObjectDefinition,
} from "./enterprise-object";

export type {
  SurfaceKind,
  ProjectionMode,
  LayoutSectionDefinition,
  ProjectionDisplay,
  ProjectionDefinition,
} from "./projection-definition";

export type {
  ObjectInstanceSnapshot,
  UserContext,
  PermissionContext,
  PolicyContext,
  TelemetrySink,
  RuntimeContext,
} from "./context";

export type {
  ResolvedField,
  ResolvedSection,
  ResolvedIntent,
  ResolvedPostAction,
  ProjectionTelemetry,
  RenderPlan,
  UniversalProjection,
} from "./universal-projection";
