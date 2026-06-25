-- LAWRENCE Phase 2 schema pack — support domain pack (§11).

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text not null,
  description text,
  status text not null default 'open',
  priority text,
  assignee_user_id uuid references users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  body text,
  source_asset_id uuid references raw_assets(id) on delete set null,
  created_at timestamptz not null default now()
);
