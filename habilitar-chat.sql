UPDATE tenants SET funcionalidades_customizadas = TRUE, funcionalidades_config = jsonb_set(COALESCE(funcionalidades_config, '{}'), '{permite_chat_atendimento}', 'true') WHERE id = 1;
SELECT id, nome, funcionalidades_config->>'permite_chat_atendimento' as chat_habilitado FROM tenants WHERE id = 1;

