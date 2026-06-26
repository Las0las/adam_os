-- LAWRENCE Phase 8 — domain pack productization. Reference relational schema
-- (runtime persists rt_* jsonb tables via the Collection abstraction). Pack
-- definitions live in the in-code manifest registry; installations + demo runs
-- are per-tenant.

create table domain_pack_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  version text not null,
  description text,
  category text not null,
  -- recruiting | onboarding | support | claims | executive | commercial | healthcare | professional_services | generic
  manifest jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (key, version)
);

create table domain_pack_installations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pack_key text not null,
  pack_version text not null,
  status text not null default 'installed',
  -- installed | disabled | failed | uninstalled
  installed_by uuid references users(id) on delete set null,
  installed_at timestamptz not null default now(),
  disabled_at timestamptz,
  uninstalled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (tenant_id, pack_key, pack_version)
);

create table domain_pack_demo_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pack_key text not null,
  demo_key text not null,
  status text not null default 'queued',
  -- queued | running | completed | failed
  created_by uuid references users(id) on delete set null,
  trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_domain_pack_installations_tenant
  on domain_pack_installations (tenant_id, pack_key, status);
create index idx_domain_pack_demo_runs_tenant
  on domain_pack_demo_runs (tenant_id, pack_key, created_at desc);
