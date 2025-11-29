-- =====================================================
-- SCRIPT PARA VERIFICAR E CORRIGIR PLANO DO TENANT DE TESTE
-- =====================================================

-- 1. VERIFICAR TODOS OS TENANTS E SEUS PLANOS
SELECT 
    t.id,
    t.nome,
    t.slug,
    t.plan_id,
    p.nome as plano_nome,
    p.limite_contas_whatsapp as limite_whatsapp_plano,
    t.limite_whatsapp_customizado,
    COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1) as limite_final,
    (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as instancias_atuais
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
ORDER BY t.id;

-- 2. VERIFICAR OS PLANOS DISPONÍVEIS
SELECT 
    id,
    nome,
    limite_usuarios,
    limite_contas_whatsapp,
    limite_campanhas_mes,
    limite_mensagens_dia,
    limite_consultas_mes
FROM plans
ORDER BY id;

-- =====================================================
-- CORREÇÃO: ATUALIZAR O TENANT DE TESTE
-- =====================================================

-- Opção 1: Se o plano "teste" existe e tem limite adequado
-- Basta associar o tenant ao plano teste
UPDATE tenants 
SET plan_id = (SELECT id FROM plans WHERE nome ILIKE '%teste%' LIMIT 1)
WHERE slug = 'teste' OR nome ILIKE '%teste%';

-- Opção 2: Criar um plano "Teste" se não existir
INSERT INTO plans (
    nome, 
    descricao, 
    limite_usuarios, 
    limite_contas_whatsapp, 
    limite_campanhas_mes, 
    limite_mensagens_dia, 
    limite_consultas_mes,
    ativo
) VALUES (
    'Plano Teste',
    'Plano para testes com limites generosos',
    10,  -- 10 usuários
    50,  -- 50 conexões WhatsApp (ou -1 para ilimitado)
    100, -- 100 campanhas por mês
    10000, -- 10.000 mensagens por dia
    1000 -- 1.000 consultas Nova Vida por mês
, true)
ON CONFLICT DO NOTHING;

-- Opção 3: Atualizar o plano existente "teste" para ter limites adequados
UPDATE plans
SET 
    limite_usuarios = 10,
    limite_contas_whatsapp = 50,  -- ou -1 para ilimitado
    limite_campanhas_mes = 100,
    limite_mensagens_dia = 10000,
    limite_consultas_mes = 1000,
    ativo = true
WHERE nome ILIKE '%teste%';

-- Opção 4: Usar limites customizados no próprio tenant (sobrescreve o plano)
UPDATE tenants
SET 
    limites_customizados = true,
    limite_usuarios_customizado = 10,
    limite_whatsapp_customizado = 50,  -- ou -1 para ilimitado
    limite_campanhas_simultaneas_customizado = 100,
    limite_mensagens_dia_customizado = 10000,
    limite_novavida_mes_customizado = 1000
WHERE slug = 'teste' OR nome ILIKE '%teste%';

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar se a correção funcionou
SELECT 
    t.id,
    t.nome,
    t.slug,
    t.plan_id,
    p.nome as plano_nome,
    t.limites_customizados,
    COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1) as limite_whatsapp,
    (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id) as instancias_atuais
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
WHERE t.slug = 'teste' OR t.nome ILIKE '%teste%'
ORDER BY t.id;

-- Verificar se a coluna existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
  AND column_name IN ('limite_whatsapp_customizado', 'limite_contas_whatsapp_customizado')
ORDER BY column_name;






