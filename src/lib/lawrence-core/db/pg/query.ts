// Thin typed query helper over the Postgres pool (Phase 2 §21). Route handlers
// and repository services call this; they never construct SQL ad hoc elsewhere.

import { getDb } from "./client";

export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = getDb();
  const result = await db.query(text, params);
  return result.rows as T[];
}
