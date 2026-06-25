# Runtime persistence (`rt_*` tables)

The LAWRENCE runtime models AI functions, agents, and actions as **code
registries** (typed contracts in `src/lib`), not database rows — so run records
reference them by stable key. To persist faithfully to Postgres without
distorting that design, the runtime uses a **jsonb document table per
collection**, created automatically by `PgCollection` on first use:

```sql
create table if not exists rt_<collection> (
  id        text primary key,
  tenant_id text not null,
  data      jsonb not null
);
create index if not exists rt_<collection>_tenant_idx on rt_<collection> (tenant_id);
```

One table per in-memory collection (e.g. `rt_ontology_objects`,
`rt_evidence_chunks`, `rt_function_runs`, `rt_action_executions`, …). The whole
row is stored as `data`; tenant scoping is enforced in SQL; JS predicates filter
the returned rows — so services behave **identically** across the in-memory and
Postgres backends.

## Relationship to `db/migrations/`

`db/migrations/0001–0010` is the **canonical relational reference schema**
(uuid PKs, foreign keys, the normalized Phase 2 model). It is applied by
`npm run migrate` and verified to load on Postgres 16. The `rt_*` tables are the
runtime's own persistence and coexist with it in the same database. A future
pass can migrate the runtime onto the normalized tables table-by-table behind
the same `Collection` interface; nothing above the data-access seam changes.

## Selecting the backend

`src/lib/lawrence-core/db/index.ts` chooses the backend at startup:
`DATABASE_URL` set → `PgCollection` (Postgres); otherwise `MemoryCollection`
(in-memory, the default for local dev and the unit-test suite).
