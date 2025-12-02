-- ============================================
-- CORRIGIR POLÍTICAS RLS DE QR_TEMPLATES
-- ============================================
-- As políticas antigas não permitiam SELECT
-- Criando 4 políticas completas (SELECT, INSERT, UPDATE, DELETE)
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS tenant_isolation_policy ON qr_templates;
DROP POLICY IF EXISTS tenant_insert_policy ON qr_templates;
DROP POLICY IF EXISTS tenant_select_policy ON qr_templates;
DROP POLICY IF EXISTS tenant_update_policy ON qr_templates;
DROP POLICY IF EXISTS tenant_delete_policy ON qr_templates;

-- Garantir que RLS está habilitado
ALTER TABLE qr_templates ENABLE ROW LEVEL SECURITY;

-- Criar política para SELECT (listar/buscar)
CREATE POLICY tenant_select_policy ON qr_templates
  FOR SELECT
  USING (tenant_id = get_current_tenant());

-- Criar política para INSERT (criar)
CREATE POLICY tenant_insert_policy ON qr_templates
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant());

-- Criar política para UPDATE (editar)
CREATE POLICY tenant_update_policy ON qr_templates
  FOR UPDATE
  USING (tenant_id = get_current_tenant())
  WITH CHECK (tenant_id = get_current_tenant());

-- Criar política para DELETE (deletar)
CREATE POLICY tenant_delete_policy ON qr_templates
  FOR DELETE
  USING (tenant_id = get_current_tenant());

-- Verificar políticas criadas
\d+ qr_templates

