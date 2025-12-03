-- Atualizar variáveis do template trial_expired para incluir valor_megatop
UPDATE email_templates 
SET variables = '["nome", "email", "data_inicio_trial", "data_fim_trial", "valor_basico", "valor_profissional", "valor_empresarial", "valor_megatop", "url_planos", "dias_para_exclusao"]'::jsonb
WHERE event_type = 'trial_expired';

-- Atualizar o HTML para incluir o plano Mega Top
UPDATE email_templates 
SET html_content = REPLACE(
  html_content,
  '<li>💎 <strong>Empresarial:</strong> R$ {{valor_empresarial}}/mês</li>
          </ul>',
  '<li>💎 <strong>Empresarial:</strong> R$ {{valor_empresarial}}/mês</li>
            <li>🚀 <strong>Mega Top:</strong> R$ {{valor_megatop}}/mês</li>
          </ul>'
)
WHERE event_type = 'trial_expired' 
AND html_content LIKE '%valor_empresarial%'
AND html_content NOT LIKE '%valor_megatop%';

