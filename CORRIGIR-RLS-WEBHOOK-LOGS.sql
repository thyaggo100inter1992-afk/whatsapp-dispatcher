-- ========================================
-- 🔧 CORRIGIR ROW LEVEL SECURITY (RLS)
-- Tabela: webhook_logs
-- ========================================

-- PROBLEMA:
-- A tabela webhook_logs tem RLS ativado, mas não tem políticas
-- que permitam INSERT sem tenant_id (webhooks públicos do Facebook)

-- SOLUÇÃO 1: Desabilitar RLS na tabela webhook_logs (RECOMENDADO)
-- Webhooks são públicos e não precisam de RLS
ALTER TABLE webhook_logs DISABLE ROW LEVEL SECURITY;

-- ========================================
-- ✅ VERIFICAR SE FUNCIONOU
-- ========================================

-- Testar INSERT direto
INSERT INTO webhook_logs 
(request_type, request_method, webhook_object, request_body, ip_address, user_agent)
VALUES 
('test', 'POST', 'whatsapp_business_account', '{"test": true}', '127.0.0.1', 'test')
RETURNING id;

-- Se retornar um ID = FUNCIONOU! ✅
-- Se retornar erro = Ainda tem problema ❌

-- ========================================
-- SOLUÇÃO ALTERNATIVA (se a primeira não funcionar)
-- ========================================

-- Criar política que permite INSERT para todos
CREATE POLICY webhook_logs_insert_policy 
ON webhook_logs 
FOR INSERT 
WITH CHECK (true);

-- Criar política que permite SELECT para todos
CREATE POLICY webhook_logs_select_policy 
ON webhook_logs 
FOR SELECT 
USING (true);

-- Criar política que permite UPDATE para todos
CREATE POLICY webhook_logs_update_policy 
ON webhook_logs 
FOR UPDATE 
USING (true);

-- ========================================
-- 🔍 VERIFICAR STATUS ATUAL DO RLS
-- ========================================

-- Ver se RLS está ativado
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'webhook_logs';

-- Ver políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'webhook_logs';










