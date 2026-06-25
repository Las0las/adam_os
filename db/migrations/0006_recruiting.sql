-- LAWRENCE Phase 2 schema pack — recruiting domain pack (§9).

create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  priority text not null default 'C',
  client_name text,
  location text,
  compensation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  location text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  stage text not null default 'new',
  score numeric,
  rationale text,
  created_at timestamptz not null default now()
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  interview_type text,
  scheduled_at timestamptz,
  status text not null default 'scheduled',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  status text not null default 'draft',
  compensation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
