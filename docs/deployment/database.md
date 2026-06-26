# Database
- Set `DATABASE_URL` to enable the Postgres backend. Absent it, the runtime uses an in-memory store (dev/test only).
- Runtime tables are `rt_<collection>` jsonb documents created on demand; tenant scoping is enforced in SQL.
- `db/migrations/000N_*.sql` is the canonical relational reference schema (one pack per phase, through `0014`).
- `db/seeds/*.sql` provide reference seeds; the runtime installers (bootstrap, pack installer) seed via services.
- Apply reference migrations with your migration tool or `npx tsx scripts/run-migrations.ts`.

## Row-level security (tenant isolation)

Tenant isolation is defense-in-depth: in addition to the per-query `WHERE tenant_id`
filters, every runtime transaction sets a transaction-local `app.tenant_id` GUC, and
the `rt_*` tables carry an RLS policy that restricts each row to the current tenant.
With no GUC set, an RLS-enabled table exposes no rows (fail closed).

Because a Postgres **superuser/owner bypasses RLS**, enforcing it requires a two-role model:

1. **Create a non-superuser app role** (once; manage its password via your secret store):
   `create role lawrence_app login password '…' nosuperuser nobypassrls;`
   `grant usage on schema public to lawrence_app;`
2. **Provision tables + RLS as the privileged owner** (the role behind your migration
   `DATABASE_URL`): `LAWRENCE_DB_APP_ROLE=lawrence_app DATABASE_URL=…owner… npm run setup:rls`.
   This creates every `rt_*` table, applies `db/migrations/0015_runtime_rls.sql`, and grants
   the app role. Re-run after adding new runtime collections.
3. **Point the app at the app role**: set the runtime `DATABASE_URL` to `lawrence_app` and
   `LAWRENCE_DB_MANAGED_SCHEMA=1` (the non-owner role does not run DDL).

`tests/integration/rls-tenant-isolation.test.ts` (CI `postgres` job) proves cross-tenant
reads/writes are blocked at the database layer, not just by the application filters.
