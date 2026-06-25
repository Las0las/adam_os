-- LAWRENCE Phase 2 schema pack — onboarding domain pack (§10).

create table onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  status text not null default 'draft',
  start_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  case_id uuid not null references onboarding_cases(id) on delete cascade,
  owner_user_id uuid references users(id) on delete set null,
  title text not null,
  status text not null default 'open',
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
