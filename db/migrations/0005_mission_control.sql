-- LAWRENCE Phase 2 schema pack — Mission Control actions/review/notify/deploy (§8).

create table approval_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table action_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  object_type text,
  input_schema jsonb not null,
  approval_policy_id uuid references approval_policies(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table action_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  action_id uuid not null references action_definitions(id) on delete cascade,
  object_type text,
  object_id uuid,
  status text not null default 'queued',
  input jsonb not null,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table review_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  case_type text not null,
  subject_object_type text,
  subject_object_id uuid,
  status text not null default 'open',
  severity text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table review_case_events (
  id uuid primary key default gen_random_uuid(),
  review_case_id uuid not null references review_cases(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  channel text not null,
  title_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, key, channel)
);

create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  event_type text not null,
  channel text not null,
  template_id uuid references notification_templates(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rule_id uuid references notification_rules(id) on delete set null,
  recipient_user_id uuid references users(id) on delete set null,
  channel text not null,
  title text not null,
  body text not null,
  state text not null default 'queued',
  deep_link text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table deployment_releases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  environment text not null,
  release_type text not null,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  promoted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  promoted_at timestamptz
);

create table runtime_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  severity text not null,
  status text not null default 'open',
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
