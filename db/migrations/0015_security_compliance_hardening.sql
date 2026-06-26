-- LAWRENCE Phase 10 — security, tenancy, compliance, audit hardening. Reference
-- relational schema (runtime persists rt_* jsonb tables via the Collection
-- abstraction). Audit hash-chain columns harden audit_events for tamper evidence.

create table security_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  policy_type text not null,
  status text not null default 'active',
  config jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table object_access_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  object_type text not null,
  policy_key text not null,
  rule_type text not null, -- allow | deny | mask | redact | require_approval
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, object_type, policy_key)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table group_memberships (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table group_roles (
  group_id uuid not null references groups(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, role_id)
);

create table object_acl_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  principal_type text not null, -- user | group | role
  principal_id uuid not null,
  permission text not null, -- read | write | approve | execute | admin
  effect text not null default 'allow', -- allow | deny
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_object_acl_lookup
  on object_acl_entries (tenant_id, object_type, object_id, principal_type, principal_id);

create table data_classifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  object_type text,
  object_id uuid,
  field_path text,
  classification text not null,
  source text not null default 'manual',
  confidence numeric,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_data_classifications_object
  on data_classifications (tenant_id, object_type, object_id);

create table redaction_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  classification text not null,
  strategy text not null, -- mask | remove | hash | token | last4
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table retention_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  object_type text not null,
  retention_days integer not null,
  action text not null, -- archive | redact | delete | review
  status text not null default 'active',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table retention_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  retention_policy_id uuid references retention_policies(id) on delete set null,
  status text not null default 'queued', -- queued | running | completed | failed | blocked
  affected_count integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table compliance_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  export_type text not null,
  status text not null default 'queued',
  requested_by uuid references users(id) on delete set null,
  parameters jsonb not null default '{}'::jsonb,
  storage_path text,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

-- Audit integrity: tamper-evident hash chain on audit_events.
alter table audit_events
  add column if not exists previous_hash text,
  add column if not exists event_hash text,
  add column if not exists integrity_version integer not null default 1;

create table audit_integrity_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  status text not null, -- passed | failed
  checked_from timestamptz,
  checked_to timestamptz,
  failure_event_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table security_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  severity text not null, -- low | medium | high | critical
  finding_type text not null,
  title text not null,
  summary text,
  object_type text,
  object_id uuid,
  status text not null default 'open',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_security_policies_tenant_type on security_policies (tenant_id, policy_type, status);
create index idx_object_access_policies_tenant_object on object_access_policies (tenant_id, object_type, status);
create index idx_retention_policies_tenant_object on retention_policies (tenant_id, object_type, status);
create index idx_compliance_exports_tenant_status on compliance_exports (tenant_id, status, created_at desc);
create index idx_security_findings_tenant_status on security_findings (tenant_id, status, severity);
