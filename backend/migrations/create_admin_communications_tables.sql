-- ============================================
-- SISTEMA DE COMUNICAÇÃO - SUPER ADMIN
-- ============================================

-- 1. TABELA: Campanhas de Email
CREATE TABLE IF NOT EXISTS admin_email_campaigns (
    id SERIAL PRIMARY KEY,
    
    -- Informações básicas
    name VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Destinatários
    recipient_type VARCHAR(50) NOT NULL, -- 'all', 'active', 'blocked', 'trial', 'specific', 'manual', 'file'
    recipient_list JSONB, -- Array de IDs de tenants ou emails
    
    -- Configurações de envio
    email_accounts JSONB, -- Array de IDs das contas de email para rotação
    delay_seconds INTEGER DEFAULT 5, -- Delay entre envios
    
    -- Estatísticas
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'sending', 'completed', 'failed', 'paused', 'cancelled'
    
    -- Metadados
    created_by INTEGER, -- ID do super admin (futuro)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Logs
    error_log TEXT
);

-- 2. TABELA: Destinatários das Campanhas (detalhamento)
CREATE TABLE IF NOT EXISTS admin_email_campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES admin_email_campaigns(id) ON DELETE CASCADE,
    
    -- Destinatário
    email VARCHAR(255) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    
    -- Status de envio
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
    sent_at TIMESTAMP,
    email_account_id INTEGER, -- Qual conta foi usada para enviar
    
    -- Erros
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA: Notificações Pop-up
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    
    -- Conteúdo
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'urgent', 'success'
    
    -- Link opcional
    link_url TEXT,
    link_text VARCHAR(100),
    
    -- Destinatários
    recipient_type VARCHAR(50) NOT NULL, -- 'all', 'active', 'blocked', 'trial', 'specific', 'plan'
    recipient_list JSONB, -- Array de IDs de tenants ou filtros
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadados
    created_by INTEGER, -- ID do super admin (futuro)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- 4. TABELA: Leituras das Notificações (tracking)
CREATE TABLE IF NOT EXISTS admin_notification_reads (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Tracking
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP,
    closed_at TIMESTAMP,
    
    -- Impedir duplicatas
    UNIQUE(notification_id, tenant_id)
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON admin_email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON admin_email_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON admin_email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON admin_email_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email ON admin_email_campaign_recipients(email);

CREATE INDEX IF NOT EXISTS idx_notifications_active ON admin_notifications(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON admin_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON admin_notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_tenant ON admin_notification_reads(tenant_id);

-- ============================================
-- RLS (Row Level Security) - Super Admin Only
-- ============================================

-- Campanhas de Email
ALTER TABLE admin_email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_email_campaigns_policy ON admin_email_campaigns
    USING (true) -- Super admin terá acesso via middleware, não via RLS
    WITH CHECK (true);

-- Destinatários
ALTER TABLE admin_email_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_email_campaign_recipients_policy ON admin_email_campaign_recipients
    USING (true)
    WITH CHECK (true);

-- Notificações
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notifications_policy ON admin_notifications
    USING (true)
    WITH CHECK (true);

-- Leituras (Tenants podem marcar suas próprias leituras)
ALTER TABLE admin_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notification_reads_tenant_policy ON admin_notification_reads
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::INTEGER)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::INTEGER);

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE admin_email_campaigns IS 'Campanhas de email em massa enviadas pelo Super Admin';
COMMENT ON TABLE admin_email_campaign_recipients IS 'Destinatários individuais de cada campanha';
COMMENT ON TABLE admin_notifications IS 'Notificações pop-up exibidas para tenants';
COMMENT ON TABLE admin_notification_reads IS 'Tracking de visualizações e cliques nas notificações';

SELECT '✅ Tabelas de Comunicação criadas com sucesso!' as status;

