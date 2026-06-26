-- Runtime row-level security (§47). The runtime persists tenant-scoped jsonb
-- document tables `rt_<name> (id, tenant_id, data)` (see db/pg/pg-collection.ts).
-- App-layer code already filters every query by tenant_id; this migration adds
-- the database-enforced second line of defense so a missing/incorrect filter can
-- never leak data across tenants.
--
-- Why a migration is required: the prior model created rt_* tables lazily as the
-- single connecting role and relied solely on WHERE clauses. Real RLS needs a
-- privileged owner to define policies AND the app to connect as a NON-owner,
-- non-superuser role (a superuser/owner bypasses RLS). This function is the
-- owner-run step; scripts/setup-runtime-rls.ts provisions the tables and invokes
-- it, then the app connects as the granted app role with LAWRENCE_DB_MANAGED_SCHEMA=1.
--
-- Isolation key: each runtime transaction sets a transaction-local GUC
-- `app.tenant_id` (see withTenantTx); the policy below restricts every row to the
-- current tenant. With no GUC set, RLS-enabled tables expose no rows (fail closed).

create or replace function lawrence_apply_runtime_rls(app_role text default null)
  returns void
  language plpgsql
as $$
declare
  r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'rt\_%'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    -- FORCE so the table owner is also subject to the policy (the app role may
    -- otherwise be the owner in single-database setups).
    execute format('alter table public.%I force row level security', r.tablename);
    execute format('drop policy if exists rt_tenant_isolation on public.%I', r.tablename);
    execute format(
      'create policy rt_tenant_isolation on public.%I '
      'using (tenant_id = current_setting(''app.tenant_id'', true)) '
      'with check (tenant_id = current_setting(''app.tenant_id'', true))',
      r.tablename
    );
    if app_role is not null and length(app_role) > 0 then
      execute format(
        'grant select, insert, update, delete on public.%I to %I',
        r.tablename, app_role
      );
    end if;
  end loop;
end;
$$;
