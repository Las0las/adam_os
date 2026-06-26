-- LAWRENCE Phase 6 — Mission Control hardening: governance + deployment control
-- plane. Reference relational schema (the runtime persists these as rt_* jsonb
-- document tables via the Collection abstraction; this file is the canonical
-- model and migration target for a relational deployment).

create table environments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  environment_type text not null, -- dev | staging | prod
  status text not null default 'active', -- active | inactive | locked
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table release_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  -- draft | pending_approval | approved | rejected | promoted | rolled_back | failed
  release_type text not null,
  -- pipeline | function | agent | action | config | domain_pack | mixed
  source_environment_id uuid references environments(id) on delete set null,
  target_environment_id uuid references environments(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  promoted_by uuid references users(id) on delete set null,
  rollback_of_release_id uuid references release_bundles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  promoted_at timestamptz,
  rolled_back_at timestamptz,
  unique (tenant_id, key)
);

create table release_bundle_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  release_bundle_id uuid not null references release_bundles(id) on delete cascade,
  item_type text not null,
  -- pipeline | function | agent | action | prompt | model | notification_rule | domain_pack | config
  item_id uuid,
  item_key text,
  item_version integer,
  change_type text not null default 'update',
  -- create | update | delete | enable | disable
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject_type text not null,
  -- release_bundle | action_execution | rollback | kill_switch
  subject_id uuid not null,
  policy_id uuid references approval_policies(id) on delete set null,
  status text not null default 'pending',
  -- pending | approved | rejected | cancelled
  requested_by uuid references users(id) on delete set null,
  assigned_to uuid references users(id) on delete set null,
  reason text,
  decision_note text,
  decided_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table runtime_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  component_type text not null,
  -- pipeline | function | agent | action | notification_rule | model | integration
  component_key text not null,
  component_id uuid,
  environment_id uuid references environments(id) on delete set null,
  status text not null default 'enabled',
  -- enabled | disabled | degraded | failed
  version integer,
  config jsonb not null default '{}'::jsonb,
  last_health_status text,
  last_health_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, component_type, component_key, environment_id)
);

create table kill_switches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  component_type text not null,
  component_key text not null,
  environment_id uuid references environments(id) on delete set null,
  enabled boolean not null default false,
  reason text,
  enabled_by uuid references users(id) on delete set null,
  disabled_by uuid references users(id) on delete set null,
  enabled_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, component_type, component_key, environment_id)
);

create table runtime_health_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  component_type text not null,
  component_key text not null,
  status text not null,
  -- healthy | degraded | failed | unknown
  latency_ms integer,
  message text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table rollback_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  release_bundle_id uuid not null references release_bundles(id) on delete cascade,
  rollback_release_bundle_id uuid references release_bundles(id) on delete set null,
  reason text not null,
  status text not null default 'requested',
  -- requested | pending_approval | approved | completed | failed | rejected
  requested_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  completed_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_release_bundles_tenant_status
  on release_bundles (tenant_id, status, created_at desc);

create index idx_approval_requests_tenant_status
  on approval_requests (tenant_id, status, created_at desc);

create index idx_runtime_components_tenant_env
  on runtime_components (tenant_id, environment_id, component_type);

create index idx_kill_switches_tenant_component
  on kill_switches (tenant_id, component_type, component_key);

create index idx_runtime_health_checks_tenant_checked
  on runtime_health_checks (tenant_id, checked_at desc);
