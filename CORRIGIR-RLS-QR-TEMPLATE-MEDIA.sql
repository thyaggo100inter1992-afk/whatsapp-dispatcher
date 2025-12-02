-- ============================================
-- CORRIGIR RLS PARA QR_TEMPLATE_MEDIA
-- ============================================
-- A tabela qr_template_media não tem tenant_id diretamente
-- Ela precisa verificar através do template_id → qr_templates
-- ============================================

-- Remover políticas antigas que estão erradas
DROP POLICY IF EXISTS tenant_isolation_policy ON qr_template_media;
DROP POLICY IF EXISTS tenant_insert_policy ON qr_template_media;

-- Criar políticas corretas que verificam através do JOIN com qr_templates
CREATE POLICY tenant_isolation_policy ON qr_template_media
  FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM qr_templates 
      WHERE tenant_id = get_current_tenant()
    )
  );

CREATE POLICY tenant_insert_policy ON qr_template_media
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM qr_templates 
      WHERE tenant_id = get_current_tenant()
    )
  );

CREATE POLICY tenant_update_policy ON qr_template_media
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM qr_templates 
      WHERE tenant_id = get_current_tenant()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM qr_templates 
      WHERE tenant_id = get_current_tenant()
    )
  );

CREATE POLICY tenant_delete_policy ON qr_template_media
  FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM qr_templates 
      WHERE tenant_id = get_current_tenant()
    )
  );

-- Verificar se as políticas foram criadas
\d+ qr_template_media

