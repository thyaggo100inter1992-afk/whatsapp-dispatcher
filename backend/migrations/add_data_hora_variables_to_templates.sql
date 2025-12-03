-- Adicionar variáveis data_atual e hora_atual em todos os templates de email

-- Welcome
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'welcome' 
AND NOT (variables ? 'data_atual');

-- Trial Start
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'trial_start' 
AND NOT (variables ? 'data_atual');

-- Trial Expired
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'trial_expired' 
AND NOT (variables ? 'data_atual');

-- Expiry 3 Days
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'expiry_3days' 
AND NOT (variables ? 'data_atual');

-- Expiry 2 Days
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'expiry_2days' 
AND NOT (variables ? 'data_atual');

-- Expiry 1 Day
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'expiry_1day' 
AND NOT (variables ? 'data_atual');

-- Blocked
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'blocked' 
AND NOT (variables ? 'data_atual');

-- Deletion Warning
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'deletion_warning' 
AND NOT (variables ? 'data_atual');

-- PIX Generated
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'pix_generated' 
AND NOT (variables ? 'data_atual');

-- Payment Confirmed
UPDATE email_templates 
SET variables = variables || '["data_atual", "hora_atual"]'::jsonb
WHERE event_type = 'payment_confirmed' 
AND NOT (variables ? 'data_atual');

