-- LAWRENCE Phase 2 schema pack — AIOps prompts/models/functions/agents/evals (§7).

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  template text not null,
  output_schema jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table model_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  provider text not null,
  model_key text not null,
  purpose text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table retrieval_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table ai_functions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  input_schema jsonb not null,
  output_schema jsonb not null,
  prompt_template_id uuid references prompt_templates(id) on delete set null,
  retrieval_policy_id uuid references retrieval_policies(id) on delete set null,
  writeback_policy jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table function_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  function_id uuid not null references ai_functions(id) on delete cascade,
  status text not null default 'queued',
  input jsonb not null,
  output jsonb,
  error_message text,
  trace jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table agent_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  graph jsonb not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agent_definitions(id) on delete cascade,
  status text not null default 'queued',
  input jsonb not null,
  output jsonb,
  error_message text,
  trace jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table retrieval_traces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_type text not null,
  run_id uuid not null,
  query text not null,
  methods jsonb not null,
  hits jsonb not null,
  created_at timestamptz not null default now()
);

create table eval_suites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  suite_type text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table eval_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  eval_suite_id uuid not null references eval_suites(id) on delete cascade,
  input jsonb not null,
  expected jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  eval_suite_id uuid not null references eval_suites(id) on delete cascade,
  status text not null default 'queued',
  summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
