-- ============================================
-- MIGRATION 041 (Alternativa): Inserir Planos de Pagamento
-- Data: 2024-11-24
-- Descrição: Inserir planos para sistema de pagamentos
-- ============================================

-- Inserir/atualizar planos de pagamento
-- Usando INSERT ... ON CONFLICT para não duplicar

INSERT INTO plans (
  nome, slug, descricao, 
  preco_mensal, preco_anual,
  limite_usuarios, limite_contas_whatsapp, 
  limite_campanhas_mes, limite_mensagens_mes,
  limite_contatos, limite_templates,
  permite_api_oficial, permite_qr_connect,
  permite_webhook, permite_agendamento,
  permite_relatorios, permite_export_dados,
  ativo, visivel, ordem,
  duracao_trial_dias
) VALUES
-- Plano Básico
(
  'Básico', 'basico', 'Ideal para começar com WhatsApp',
  97.00, 970.00,
  3, 1,
  5, 5000,
  500, 20,
  true, true,
  false, true,
  true, true,
  true, true, 1,
  3
),
-- Plano Profissional  
(
  'Profissional', 'profissional', 'Para empresas em crescimento',
  197.00, 1970.00,
  10, 3,
  20, 20000,
  5000, 50,
  true, true,
  true, true,
  true, true,
  true, true, 2,
  3
),
-- Plano Empresarial
(
  'Empresarial', 'empresarial', 'Para grandes volumes',
  497.00, 4970.00,
  50, 10,
  100, 100000,
  50000, 100,
  true, true,
  true, true,
  true, true,
  true, true, 3,
  3
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco_mensal = EXCLUDED.preco_mensal,
  preco_anual = EXCLUDED.preco_anual,
  limite_usuarios = EXCLUDED.limite_usuarios,
  limite_contas_whatsapp = EXCLUDED.limite_contas_whatsapp,
  limite_campanhas_mes = EXCLUDED.limite_campanhas_mes,
  limite_mensagens_mes = EXCLUDED.limite_mensagens_mes,
  limite_contatos = EXCLUDED.limite_contatos,
  limite_templates = EXCLUDED.limite_templates,
  duracao_trial_dias = EXCLUDED.duracao_trial_dias,
  updated_at = NOW();

-- Comentário
COMMENT ON TABLE plans IS 'Planos disponíveis para assinatura (incluindo planos de pagamento)';





