-- LAWRENCE Phase 2 schema pack — canonical + ontology + evidence + lineage (§6).

create table canonical_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  raw_asset_id uuid not null references raw_assets(id) on delete cascade,
  document_type text not null,
  title text,
  text_content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table canonical_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references canonical_documents(id) on delete cascade,
  record_type text not null,
  payload jsonb not null,
  source_path text,
  created_at timestamptz not null default now()
);

create table evidence_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source_object_type text not null,
  source_object_id uuid not null,
  chunk_index integer not null,
  text text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding_id uuid,
  created_at timestamptz not null default now()
);

create index idx_evidence_chunks_source
  on evidence_chunks (tenant_id, source_object_type, source_object_id);

create table ontology_objects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  object_type text not null,
  external_key text,
  title text,
  status text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ontology_objects_type
  on ontology_objects (tenant_id, object_type);

create index idx_ontology_objects_external_key
  on ontology_objects (tenant_id, object_type, external_key);

create table ontology_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  link_type text not null,
  from_object_type text not null,
  from_object_id uuid not null,
  to_object_type text not null,
  to_object_id uuid not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table object_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  event_type text not null,
  diff jsonb not null default '{}'::jsonb,
  actor_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table lineage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pipeline_run_id uuid references pipeline_runs(id) on delete set null,
  source_type text not null,
  source_id uuid,
  target_type text not null,
  target_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
