-- =====================================================
-- DIAGNÓSTICO: Erro 403 ao criar instância
-- =====================================================

-- 1️⃣ Verificar funcionalidades do tenant
SELECT 
  t.id as tenant_id,
  t.nome as tenant_nome,
  t.funcionalidades_customizadas,
  t.funcionalidades_config,
  p.nome as plano,
  p.funcionalidades as plano_funcionalidades
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
WHERE t.id = 1;  -- Ajuste o ID do seu tenant

-- 2️⃣ Verificar limite de instâncias
SELECT 
  t.id as tenant_id,
  t.nome,
  COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1) as limite,
  (
    -- Contas API
    (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) +
    -- Instâncias QR Connect
    (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id)
  ) as atual,
  CASE 
    WHEN (
      (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) +
      (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id)
    ) >= COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1)
    THEN '❌ LIMITE ATINGIDO'
    ELSE '✅ OK'
  END as status
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
WHERE t.id = 1;  -- Ajuste o ID do seu tenant

-- 3️⃣ Listar instâncias existentes
SELECT 
  id,
  name,
  session_name,
  is_connected,
  is_active,
  created_at
FROM uaz_instances
WHERE tenant_id = 1  -- Ajuste o ID do seu tenant
ORDER BY created_at DESC;

-- =====================================================
-- SOLUÇÕES POSSÍVEIS:
-- =====================================================

-- SOLUÇÃO 1: Habilitar funcionalidade "whatsapp_qr"
-- Se a funcionalidade estiver desabilitada:
UPDATE tenants
SET funcionalidades_customizadas = true,
    funcionalidades_config = jsonb_set(
      COALESCE(funcionalidades_config, '{}'::jsonb),
      '{whatsapp_qr}',
      'true'::jsonb
    )
WHERE id = 1;  -- Ajuste o ID do seu tenant

-- SOLUÇÃO 2: Aumentar limite de instâncias
-- Se o limite foi atingido:
UPDATE tenants
SET limite_whatsapp_customizado = 10  -- Ajuste o limite desejado
WHERE id = 1;  -- Ajuste o ID do seu tenant

-- SOLUÇÃO 3: Deletar instâncias antigas (se necessário)
-- CUIDADO: Isso vai deletar permanentemente!
-- DELETE FROM uaz_instances 
-- WHERE id = 123;  -- ID da instância a deletar

-- =====================================================
-- VERIFICAR APÓS CORREÇÃO:
-- =====================================================
SELECT 
  t.id,
  t.nome,
  -- Funcionalidades
  CASE 
    WHEN t.funcionalidades_customizadas THEN 
      t.funcionalidades_config->>'whatsapp_qr'
    ELSE 
      p.funcionalidades->>'whatsapp_qr'
  END as whatsapp_qr_habilitado,
  -- Limites
  COALESCE(t.limite_whatsapp_customizado, p.limite_contas_whatsapp, 1) as limite,
  (
    (SELECT COUNT(*) FROM whatsapp_accounts WHERE tenant_id = t.id) +
    (SELECT COUNT(*) FROM uaz_instances WHERE tenant_id = t.id)
  ) as usado
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id
WHERE t.id = 1;  -- Ajuste o ID do seu tenant






