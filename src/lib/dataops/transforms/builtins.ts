// Built-in deterministic transforms (§15 transforms/, §16 contract).
// Each is pure: rows in, rows out. Config is validated leniently.

import type { PipelineTransform, TransformInput, TransformOutput } from "./transform-types";

function mapRows(
  rows: Record<string, unknown>[],
  fn: (row: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown>[] {
  return rows.map((r) => fn({ ...r }));
}

/** config: { columns: string[] } — trims string values in the named columns (all if omitted). */
export const trimTransform: PipelineTransform = {
  key: "trim",
  label: "Trim whitespace",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const columns = (config.columns as string[] | undefined) ?? null;
    return {
      rows: mapRows(rows, (row) => {
        for (const [k, v] of Object.entries(row)) {
          if ((!columns || columns.includes(k)) && typeof v === "string") row[k] = v.trim();
        }
        return row;
      }),
    };
  },
};

/** config: { columns?: string[] } — lowercases string values. */
export const lowercaseTransform: PipelineTransform = {
  key: "lowercase",
  label: "Lowercase",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const columns = (config.columns as string[] | undefined) ?? null;
    return {
      rows: mapRows(rows, (row) => {
        for (const [k, v] of Object.entries(row)) {
          if ((!columns || columns.includes(k)) && typeof v === "string") row[k] = v.toLowerCase();
        }
        return row;
      }),
    };
  },
};

/** config: { column: string, to: "number" | "string" | "boolean" } */
export const castTransform: PipelineTransform = {
  key: "cast",
  label: "Cast type",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const column = config.column as string;
    const to = config.to as "number" | "string" | "boolean";
    return {
      rows: mapRows(rows, (row) => {
        const v = row[column];
        if (v == null) return row;
        if (to === "number") row[column] = Number(v);
        else if (to === "string") row[column] = String(v);
        else if (to === "boolean") row[column] = v === true || v === "true" || v === "1";
        return row;
      }),
    };
  },
};

/** config: { column: string, mapping: Record<string,unknown> } */
export const mapValuesTransform: PipelineTransform = {
  key: "map_values",
  label: "Map values",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const column = config.column as string;
    const mapping = (config.mapping as Record<string, unknown>) ?? {};
    return {
      rows: mapRows(rows, (row) => {
        const key = String(row[column]);
        if (key in mapping) row[column] = mapping[key];
        return row;
      }),
    };
  },
};

/** config: { columns: string[] } — keeps only the named columns. */
export const selectColumnsTransform: PipelineTransform = {
  key: "select_columns",
  label: "Select columns",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const columns = (config.columns as string[]) ?? [];
    return {
      rows: rows.map((row) => {
        const next: Record<string, unknown> = {};
        for (const c of columns) if (c in row) next[c] = row[c];
        return next;
      }),
    };
  },
};

/** config: { order: string[] } — reorders keys; unlisted keys are appended. */
export const reorderColumnsTransform: PipelineTransform = {
  key: "reorder_columns",
  label: "Reorder columns",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const order = (config.order as string[]) ?? [];
    return {
      rows: rows.map((row) => {
        const next: Record<string, unknown> = {};
        for (const c of order) if (c in row) next[c] = row[c];
        for (const c of Object.keys(row)) if (!(c in next)) next[c] = row[c];
        return next;
      }),
    };
  },
};

/**
 * config: { column: string, cases: Array<{ when: {col,equals}, then: unknown }>, else?: unknown }
 * Writes `column` based on the first matching case.
 */
export const caseWhenTransform: PipelineTransform = {
  key: "case_when",
  label: "Case when",
  async run({ rows, config }: TransformInput): Promise<TransformOutput> {
    const column = config.column as string;
    const cases = (config.cases as Array<{ when: { col: string; equals: unknown }; then: unknown }>) ?? [];
    const fallback = config.else;
    return {
      rows: mapRows(rows, (row) => {
        const match = cases.find((c) => row[c.when.col] === c.when.equals);
        row[column] = match ? match.then : fallback;
        return row;
      }),
    };
  },
};

export const builtinTransforms: PipelineTransform[] = [
  trimTransform,
  lowercaseTransform,
  castTransform,
  mapValuesTransform,
  selectColumnsTransform,
  reorderColumnsTransform,
  caseWhenTransform,
];
