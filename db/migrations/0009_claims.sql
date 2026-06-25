-- LAWRENCE Phase 2 schema pack — claims / validation domain pack (§12).

create table validation_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  case_type text not null,
  subject_object_type text not null,
  subject_object_id uuid not null,
  status text not null default 'open',
  score numeric,
  summary text,
  created_at timestamptz not null default now()
);

create table validation_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  validation_case_id uuid not null references validation_cases(id) on delete cascade,
  severity text not null,
  finding_type text not null,
  message text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
