-- Seed default notification templates (§43, §57). Bind :tenant_id at apply time.
insert into notification_templates (tenant_id, key, channel, title_template, body_template) values
  (:tenant_id, 'review_case.created', 'in_app', 'Review required: {{caseType}}', 'A new review case requires attention: {{summary}}'),
  (:tenant_id, 'claim.critical_finding', 'in_app', 'Critical claim finding', 'Critical finding on claim {{claimId}} requires validator attention.'),
  (:tenant_id, 'onboarding.blocker', 'in_app', 'Onboarding blocker', 'Onboarding case {{caseId}} is blocked and was escalated to the owner.')
on conflict (tenant_id, key, channel) do nothing;
