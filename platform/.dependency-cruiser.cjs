/**
 * LAWRENCE Platform — Architectural Layer Rules (RFC-PC0).
 *
 * The platform is durable because its LAYER BOUNDARIES are frozen. Dependencies
 * may only point DOWN the stack:
 *
 *   Constitution -> Platform Contracts -> Kernel -> Runtime Registry
 *   -> Domain Packs -> Host Runtime -> Studios / Workspace (UI)
 *
 * The single most important invariant in Phase 0: UI / Workspace packages may
 * NEVER import Kernel internals. They speak only through frozen contracts.
 */
module.exports = {
  forbidden: [
    {
      name: "ui-no-kernel-internals",
      comment:
        "Workspace/Studio (UI) packages must never import Kernel internals. " +
        "UI talks to the platform ONLY through @lawrence/contracts. Importing " +
        "kernel internals couples UI to an implementation that is free to change.",
      severity: "error",
      from: { path: "^packages/(workspace|studio)[^/]*/" },
      to: { path: "(kernel/(src|dist)/internal|@lawrence/kernel/internal)" },
    },
    {
      name: "contracts-is-a-leaf",
      comment:
        "@lawrence/contracts is the frozen interface layer. It MUST NOT depend on " +
        "any other @lawrence package — contracts define shape, never behavior.",
      severity: "error",
      from: { path: "^packages/contracts/src/" },
      to: { path: "@lawrence/(kernel|workspace|studio|runtime|host|domain)" },
    },
    {
      name: "kernel-no-upward-deps",
      comment:
        "The Kernel sits below UI. It must not depend on Workspace/Studio packages.",
      severity: "error",
      from: { path: "^packages/kernel/src/" },
      to: { path: "@lawrence/(workspace|studio)" },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies break replay determinism and layer freeze.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "Orphan modules are dead weight; every source file must be reachable.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)index\\.ts$",
          "\\.(test|spec)\\.ts$",
          "\\.config\\.(ts|mjs|cjs|js)$",
        ],
      },
      to: {},
    },
  ],
  options: {
    // Only analyze source. Compiled output under dist/ mirrors src/ and would
    // produce duplicate, false orphan warnings.
    exclude: { path: "(^|/)(dist|node_modules)/" },
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
