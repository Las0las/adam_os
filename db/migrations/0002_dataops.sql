-- LAWRENCE Phase 2 schema pack — DataOps sources / ingestion / pipelines (§5).

create table sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  kind text not null,
  status text not null default 'active',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table ingestion_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  status text not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table raw_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  ingestion_batch_id uuid references ingestion_batches(id) on delete set null,
  parent_asset_id uuid references raw_assets(id) on delete cascade,
  kind text not null,
  file_name text not null,
  mime_type text,
  storage_path text,
  checksum_sha256 text,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_raw_assets_tenant_created_at
  on raw_assets (tenant_id, created_at desc);

create table pipeline_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  version integer not null default 1,
  graph jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, version)
);

create table pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pipeline_definition_id uuid not null references pipeline_definitions(id) on delete cascade,
  status text not null default 'queued',
  trigger_type text not null default 'manual',
  trigger_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_pipeline_runs_tenant_created_at
  on pipeline_runs (tenant_id, created_at desc);
