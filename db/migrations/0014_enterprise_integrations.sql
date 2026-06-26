-- LAWRENCE Phase 9 — enterprise integrations. Reference relational schema
-- (runtime persists rt_* jsonb tables via the Collection abstraction). The DB
-- stores only credential_ref — never secret values.

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  provider text not null,
  -- microsoft365 | google_workspace | slack | greenhouse | lever | gusto | sharepoint | one_drive | custom_api | webhook
  status text not null default 'not_configured',
  -- not_configured | active | degraded | disabled | failed
  config jsonb not null default '{}'::jsonb,
  credential_ref text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  connection_id uuid not null references integration_connections(id) on delete cascade,
  sync_type text not null,
  -- full | incremental | webhook | test
  status text not null default 'queued',
  -- queued | running | completed | failed | degraded
  started_at timestamptz,
  completed_at timestamptz,
  records_read integer not null default 0,
  records_written integer not null default 0,
  assets_created integer not null default 0,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  connection_id uuid references integration_connections(id) on delete set null,
  provider text not null,
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  -- received | processed | ignored | failed
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table integration_object_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  connection_id uuid not null references integration_connections(id) on delete cascade,
  external_object_type text not null,
  external_object_id text not null,
  lawrence_object_type text not null,
  lawrence_object_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, connection_id, external_object_type, external_object_id)
);

create index idx_integration_connections_tenant_status
  on integration_connections (tenant_id, status);
create index idx_integration_sync_runs_tenant_created
  on integration_sync_runs (tenant_id, created_at desc);
create index idx_integration_webhook_events_tenant
  on integration_webhook_events (tenant_id, provider, status);
create index idx_integration_object_mappings_tenant_external
  on integration_object_mappings (tenant_id, external_object_type, external_object_id);
