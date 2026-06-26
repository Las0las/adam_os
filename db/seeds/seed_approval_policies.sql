-- Phase 6 — default approval policies. Replace :tenant_id at apply time.
-- config jsonb mirrors ApprovalPolicyConfig (requireApproval/reasonRequired/rules).
insert into approval_policies (tenant_id, key, name, config) values
  (:tenant_id, 'prod_release_requires_approval', 'Production release requires approval',
    '{"requireApproval": true, "reasonRequired": false, "approverRoleKeys": ["role_admin"]}'::jsonb),
  (:tenant_id, 'rollback_requires_approval', 'Rollback requires approval',
    '{"requireApproval": true, "reasonRequired": true, "allowEmergencyBypass": true}'::jsonb),
  (:tenant_id, 'kill_switch_requires_reason', 'Kill switch requires reason',
    '{"requireApproval": false, "reasonRequired": true}'::jsonb),
  (:tenant_id, 'external_side_effect_requires_approval', 'External side-effect action requires approval',
    '{"requireApproval": true, "reasonRequired": false, "rules": [{"field": "external", "operator": "eq", "value": true}]}'::jsonb),
  (:tenant_id, 'destructive_action_requires_approval', 'Destructive action requires approval',
    '{"requireApproval": true, "reasonRequired": true}'::jsonb)
on conflict (tenant_id, key) do nothing;
