-- LAWRENCE Phase 2 schema pack — operational views for the Command Center and
-- Mission Control surfaces. Read-only conveniences over the base tables.

-- Open review backlog per tenant.
create view v_review_backlog as
select tenant_id, count(*) as open_cases
from review_cases
where status in ('open', 'in_review')
group by tenant_id;

-- Action execution health per tenant.
create view v_action_health as
select
  tenant_id,
  count(*) filter (where status = 'failed')   as failed,
  count(*) filter (where status = 'blocked')  as blocked,
  count(*) filter (where status = 'completed') as completed,
  count(*)                                      as total
from action_executions
group by tenant_id;

-- Ontology object counts by type per tenant.
create view v_ontology_object_counts as
select tenant_id, object_type, count(*) as object_count
from ontology_objects
group by tenant_id, object_type;

-- Recent audit activity (last 200 events per tenant), newest first.
create view v_recent_activity as
select id, tenant_id, actor_user_id, event_type, object_type, object_id, created_at
from audit_events
order by created_at desc;
