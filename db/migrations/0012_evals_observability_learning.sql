-- LAWRENCE Phase 7 — evals, observability, closed-loop learning. Reference
-- relational schema (runtime persists rt_* jsonb tables via the Collection
-- abstraction). eval_suites/eval_cases/eval_runs are extended in place.

alter table eval_suites
  add column if not exists status text not null default 'active',
  add column if not exists target_component_type text,
  add column if not exists target_component_key text,
  add column if not exists baseline_config jsonb not null default '{}'::jsonb;

alter table eval_runs
  add column if not exists target_component_type text,
  add column if not exists target_component_key text,
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists metrics jsonb not null default '{}'::jsonb,
  add column if not exists passed boolean,
  add column if not exists regression_detected boolean not null default false,
  add column if not exists created_by uuid references users(id) on delete set null;

create table eval_case_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  eval_run_id uuid not null references eval_runs(id) on delete cascade,
  eval_case_id uuid not null references eval_cases(id) on delete cascade,
  status text not null default 'completed',
  actual jsonb not null default '{}'::jsonb,
  expected jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table runtime_traces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  trace_type text not null,
  trace_id uuid not null,
  component_type text,
  component_key text,
  object_type text,
  object_id uuid,
  status text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_type text not null,
  run_id uuid not null,
  provider text,
  model_key text,
  purpose text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  latency_ms integer,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table retrieval_quality_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  run_type text not null,
  run_id uuid not null,
  query text not null,
  methods jsonb not null,
  hits jsonb not null,
  expected_object_refs jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table human_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  feedback_type text not null,
  subject_type text not null,
  subject_id uuid not null,
  object_type text,
  object_id uuid,
  rating integer,
  label text,
  comment text,
  correction jsonb,
  actor_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table recommendation_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  recommendation_object_id uuid,
  source_run_type text,
  source_run_id uuid,
  object_type text,
  object_id uuid,
  recommended_action_key text,
  decision text not null,
  outcome_status text,
  rationale text,
  actor_user_id uuid references users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table learning_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  signal_type text not null,
  component_type text,
  component_key text,
  domain text,
  object_type text,
  object_id uuid,
  severity text not null default 'medium',
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  recommended_change jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_from_feedback_id uuid references human_feedback(id) on delete set null,
  created_from_eval_run_id uuid references eval_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table observability_rollups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rollup_type text not null,
  component_type text,
  component_key text,
  window_start timestamptz not null,
  window_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, rollup_type, component_type, component_key, window_start)
);

create index idx_runtime_traces_tenant_component_created
  on runtime_traces (tenant_id, component_type, component_key, created_at desc);
create index idx_ai_usage_tenant_created on ai_usage_events (tenant_id, created_at desc);
create index idx_feedback_tenant_subject on human_feedback (tenant_id, subject_type, subject_id);
create index idx_learning_signals_tenant_status on learning_signals (tenant_id, status, created_at desc);
create index idx_recommendation_outcomes_tenant_object
  on recommendation_outcomes (tenant_id, object_type, object_id);
create index idx_eval_results_run on eval_case_results (eval_run_id);
