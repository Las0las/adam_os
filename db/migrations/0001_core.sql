-- LAWRENCE Phase 2 schema pack — core platform (§4).
-- Postgres, tenant-scoped, UUID PKs. This is the production target schema;
-- the in-memory Collection runtime mirrors it for local/test execution.

create extension if not exists "pgcrypto";

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  display_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  event_type text not null,
  object_type text,
  object_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_events_tenant_created_at
  on audit_events (tenant_id, created_at desc);
