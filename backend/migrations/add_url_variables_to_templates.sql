-- Adiciona as novas variáveis url_registro e url_site aos templates existentes

DO $$
DECLARE
    template_record RECORD;
    updated_variables JSONB;
BEGIN
    FOR template_record IN SELECT id, event_type, variables FROM email_templates LOOP
        updated_variables := template_record.variables;

        -- Adicionar 'url_registro' se não existir
        IF NOT (updated_variables @> '["url_registro"]') THEN
            updated_variables := jsonb_insert(updated_variables, '{999}', '"url_registro"', TRUE);
        END IF;

        -- Adicionar 'url_site' se não existir
        IF NOT (updated_variables @> '["url_site"]') THEN
            updated_variables := jsonb_insert(updated_variables, '{999}', '"url_site"', TRUE);
        END IF;

        UPDATE email_templates
        SET variables = updated_variables,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = template_record.id;
        
        RAISE NOTICE 'Template % atualizado com novas variáveis', template_record.event_type;
    END LOOP;
END $$;

SELECT '✅ Variáveis url_registro e url_site adicionadas a todos os templates' as status;

