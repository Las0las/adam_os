-- LAWRENCE core schema (§46). This mirrors the in-memory Collection model and is
-- the migration that backs the Postgres operational store. Every table carries
-- tenant_id and is intended to run behind row-level security (§47: every row
-- tenant-scoped). Types are kept close to the TypeScript domain model in src/types.

create extension if not exists "pgcrypto";

-- ── Core platform ────────────────────────────────────────────────────────
create table tenants (
  id          text primary key,
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table users (
  id           text primary key,
  tenant_id    text not null references tenants(id),
  email        text not null,
  display_name text not null,
  role_ids     text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table roles (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  name        text not null,
  permissions text[] not null default '{}'
);

create table audit_events (
  id            text primary key,
  tenant_id     text not null references tenants(id),
  actor_user_id text,
  action        text not null,
  subject_type  text,
  subject_id    text,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ── DataOps ──────────────────────────────────────────────────────────────
create table sources (
  id         text primary key,
  tenant_id  text not null references tenants(id),
  name       text not null,
  kind       text not null,
  config     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table raw_assets (
  id              text primary key,
  tenant_id       text not null references tenants(id),
  source_id       text references sources(id),
  kind            text not null,
  file_name       text not null,
  mime_type       text,
  checksum_sha256 text,
  size_bytes      bigint,
  parent_asset_id text references raw_assets(id),
  ingestion_batch_id text,
  content         text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create table pipeline_definitions (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  name        text not null,
  description text,
  nodes       jsonb not null default '[]',
  edges       jsonb not null default '[]',
  version     int not null default 1,
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table pipeline_runs (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  pipeline_id text not null,
  status      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb not null default '{}',
  error       text
);

create table canonical_documents (
  id            text primary key,
  tenant_id     text not null references tenants(id),
  raw_asset_id  text not null references raw_assets(id),
  document_type text not null,
  title         text,
  text_content  text,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create table canonical_records (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  document_id text,
  record_type text not null,
  payload     jsonb not null default '{}',
  source_path text,
  created_at  timestamptz not null default now()
);

create table evidence_chunks (
  id                 text primary key,
  tenant_id          text not null references tenants(id),
  source_object_type text not null,
  source_object_id   text not null,
  chunk_index        int not null,
  text               text not null,
  metadata           jsonb not null default '{}',
  embedding_id       text,
  created_at         timestamptz not null default now()
);

create table ontology_objects (
  id           text primary key,
  tenant_id    text not null references tenants(id),
  object_type  text not null,
  external_key text,
  title        text,
  status       text,
  properties   jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, object_type, external_key)
);

create table ontology_links (
  id               text primary key,
  tenant_id        text not null references tenants(id),
  link_type        text not null,
  from_object_type text not null,
  from_object_id   text not null,
  to_object_type   text not null,
  to_object_id     text not null,
  properties       jsonb,
  created_at       timestamptz not null default now()
);

create table lineage_events (
  id              text primary key,
  tenant_id       text not null references tenants(id),
  pipeline_run_id text,
  kind            text not null,
  from_type       text,
  from_id         text,
  to_type         text not null,
  to_id           text not null,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ── AIOps ────────────────────────────────────────────────────────────────
create table ai_functions (
  id            text primary key,
  tenant_id     text not null references tenants(id),
  key           text not null,
  name          text not null,
  description   text,
  input_schema  jsonb not null default '{}',
  output_schema jsonb not null default '{}',
  status        text not null default 'draft',
  created_at    timestamptz not null default now()
);

create table agent_definitions (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  key         text not null,
  name        text not null,
  description text,
  graph       jsonb not null default '{}',
  status      text not null default 'draft',
  created_at  timestamptz not null default now()
);

create table prompt_templates (
  id            text primary key,
  tenant_id     text not null references tenants(id),
  key           text not null,
  name          text not null,
  template      text not null,
  output_schema jsonb,
  status        text not null default 'draft'
);

create table model_definitions (
  id        text primary key,
  tenant_id text not null references tenants(id),
  provider  text not null,
  model_key text not null,
  purpose   text not null,
  config    jsonb not null default '{}',
  status    text not null default 'active'
);

create table function_runs (
  id          text primary key,
  tenant_id   text not null references tenants(id),
  function_id text not null,
  input       jsonb not null default '{}',
  output      jsonb,
  citations   jsonb not null default '[]',
  status      text not null,
  trace_id    text,
  error       text,
  created_at  timestamptz not null default now()
);

create table agent_runs (
  id         text primary key,
  tenant_id  text not null references tenants(id),
  agent_id   text not null,
  input      jsonb not null default '{}',
  output     jsonb,
  status     text not null,
  steps      jsonb not null default '[]',
  trace_id   text,
  error      text,
  created_at timestamptz not null default now()
);

create table retrieval_traces (
  id              text primary key,
  tenant_id       text not null references tenants(id),
  scope           text not null,
  scope_id        text not null,
  provider        text not null,
  model_key       text not null,
  prompt_tokens   int not null default 0,
  completion_tokens int not null default 0,
  latency_ms      int not null default 0,
  cost_usd        numeric not null default 0,
  retrieval_method text,
  created_at      timestamptz not null default now()
);

create table eval_cases (
  id         text primary key,
  tenant_id  text not null references tenants(id),
  suite_type text not null,
  input      jsonb not null default '{}',
  expected   jsonb not null default '{}',
  metadata   jsonb
);

create table eval_runs (
  id         text primary key,
  tenant_id  text not null references tenants(id),
  suite_type text not null,
  results    jsonb not null default '[]',
  score      numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ── Mission Control ──────────────────────────────────────────────────────
create table action_definitions (
  id                 text primary key,
  tenant_id          text not null references tenants(id),
  key                text not null,
  name               text not null,
  object_type        text,
  input_schema       jsonb not null default '{}',
  approval_policy_id text,
  required_permission text,
  created_at         timestamptz not null default now()
);

create table action_executions (
  id              text primary key,
  tenant_id       text not null references tenants(id),
  action_id       text not null,
  object_type     text,
  object_id       text,
  input           jsonb not null default '{}',
  result          jsonb,
  status          text not null,
  idempotency_key text,
  blocked_reason  text,
  review_case_id  text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table review_cases (
  id                  text primary key,
  tenant_id           text not null references tenants(id),
  case_type           text not null,
  subject_object_type text,
  subject_object_id   text,
  status              text not null default 'open',
  severity            text,
  summary             text,
  gated_action_execution_id text,
  assignee_user_id    text,
  created_at          timestamptz not null default now()
);

create table review_case_events (
  id             text primary key,
  tenant_id      text not null references tenants(id),
  review_case_id text not null references review_cases(id),
  actor_user_id  text,
  kind           text not null,
  note           text,
  created_at     timestamptz not null default now()
);

create table notification_rules (
  id             text primary key,
  tenant_id      text not null references tenants(id),
  name           text not null,
  event_key      text not null,
  channel        text not null,
  destination    text,
  recipient_role text,
  template       text not null,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now()
);

create table notifications (
  id                text primary key,
  tenant_id         text not null references tenants(id),
  rule_id           text references notification_rules(id),
  recipient_user_id text not null,
  title             text not null,
  body              text not null,
  channel           text not null,
  state             text not null,
  deep_link         text,
  dedupe_key        text,
  error             text,
  created_at        timestamptz not null default now()
);

create table deployment_releases (
  id            text primary key,
  tenant_id     text not null references tenants(id),
  name          text not null,
  artifacts     jsonb not null default '[]',
  environment   text not null default 'draft',
  status        text not null default 'draft',
  promoted_from text,
  created_at    timestamptz not null default now()
);

create table runtime_incidents (
  id         text primary key,
  tenant_id  text not null references tenants(id),
  title      text not null,
  severity   text not null,
  status     text not null default 'open',
  source     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

-- Tenant-scoped read paths benefit from these.
create index on raw_assets (tenant_id);
create index on ontology_objects (tenant_id, object_type);
create index on evidence_chunks (tenant_id, source_object_id);
create index on function_runs (tenant_id);
create index on action_executions (tenant_id, status);
create index on review_cases (tenant_id, status);
create index on audit_events (tenant_id, created_at);
