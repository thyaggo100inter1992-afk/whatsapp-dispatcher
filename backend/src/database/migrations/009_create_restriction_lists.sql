-- Sistema de Listas de Restrição
-- Migration 009: Criar tabelas para gerenciamento de restrições de envio

-- ============================================================
-- TABELA: restriction_list_types (Tipos de Listas)
-- ============================================================
-- Armazena os 3 tipos de listas:
-- 1. do_not_disturb (Não Me Perturbe) - Permanente
-- 2. blocked (Bloqueado) - 365 dias
-- 3. not_interested (Não Tenho Interesse) - 7 dias
CREATE TABLE IF NOT EXISTS restriction_list_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    retention_days INTEGER, -- NULL = permanente, 7 = 7 dias, 365 = 365 dias
    auto_add_enabled BOOLEAN DEFAULT false, -- Se pode adicionar automaticamente via webhook
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir os 3 tipos de listas
INSERT INTO restriction_list_types (id, name, description, retention_days, auto_add_enabled) VALUES
('do_not_disturb', 'Não Me Perturbe', 'Contatos que não devem receber mensagens por tempo indeterminado', NULL, false),
('blocked', 'Bloqueado', 'Contatos bloqueados por 365 dias', 365, true),
('not_interested', 'Não Tenho Interesse', 'Contatos sem interesse por 7 dias', 7, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TABELA: restriction_list_entries (Entradas das Listas)
-- ============================================================
CREATE TABLE IF NOT EXISTS restriction_list_entries (
    id SERIAL PRIMARY KEY,
    list_type VARCHAR(50) REFERENCES restriction_list_types(id) ON DELETE CASCADE,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Informações do contato
    phone_number VARCHAR(50) NOT NULL, -- Número com DDI (5511987654321)
    phone_number_alt VARCHAR(50), -- Versão alternativa (com ou sem 9º dígito)
    contact_name VARCHAR(255),
    
    -- Rastreamento de origem
    keyword_matched VARCHAR(255), -- Palavra-chave que causou a inclusão
    button_payload VARCHAR(255), -- Payload do botão clicado
    button_text VARCHAR(255), -- Texto do botão clicado
    added_method VARCHAR(50) DEFAULT 'manual', -- manual, webhook_button, webhook_keyword, import
    
    -- Datas importantes
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- NULL para listas permanentes
    
    -- Metadados
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL, -- Campanha que originou (se aplicável)
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL, -- Mensagem que originou (se aplicável)
    notes TEXT, -- Notas adicionais
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir que não haja duplicatas na mesma lista e conta
    UNIQUE(list_type, whatsapp_account_id, phone_number)
);

-- ============================================================
-- TABELA: restriction_list_keywords (Palavras-Chave)
-- ============================================================
CREATE TABLE IF NOT EXISTS restriction_list_keywords (
    id SERIAL PRIMARY KEY,
    list_type VARCHAR(50) REFERENCES restriction_list_types(id) ON DELETE CASCADE,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Palavra-chave ou payload de botão
    keyword VARCHAR(500) NOT NULL, -- Palavra-chave ou texto de botão
    keyword_type VARCHAR(50) DEFAULT 'text', -- text, button_payload, button_text
    case_sensitive BOOLEAN DEFAULT false,
    match_type VARCHAR(50) DEFAULT 'exact', -- exact, contains, starts_with, ends_with
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Garantir que não haja duplicatas
    UNIQUE(list_type, whatsapp_account_id, keyword, keyword_type)
);

-- ============================================================
-- TABELA: restriction_list_logs (Log de Ações)
-- ============================================================
CREATE TABLE IF NOT EXISTS restriction_list_logs (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES restriction_list_entries(id) ON DELETE CASCADE,
    list_type VARCHAR(50) REFERENCES restriction_list_types(id),
    
    action VARCHAR(50) NOT NULL, -- added, removed, expired, imported, manual_add, manual_remove
    phone_number VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    
    -- Rastreamento (preparado para sistema de usuários)
    performed_by VARCHAR(255), -- Será usado quando implementar sistema de usuários
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadados
    details JSONB, -- Informações adicionais sobre a ação
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- ============================================================
-- TABELA: restriction_list_stats (Estatísticas)
-- ============================================================
CREATE TABLE IF NOT EXISTS restriction_list_stats (
    id SERIAL PRIMARY KEY,
    list_type VARCHAR(50) REFERENCES restriction_list_types(id) ON DELETE CASCADE,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Contadores do dia
    total_entries INTEGER DEFAULT 0,
    added_today INTEGER DEFAULT 0,
    removed_today INTEGER DEFAULT 0,
    expired_today INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Uma entrada por dia, por lista, por conta
    UNIQUE(list_type, whatsapp_account_id, date)
);

-- ============================================================
-- ÍNDICES para melhorar performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_restriction_entries_list_type ON restriction_list_entries(list_type);
CREATE INDEX IF NOT EXISTS idx_restriction_entries_phone ON restriction_list_entries(phone_number);
CREATE INDEX IF NOT EXISTS idx_restriction_entries_phone_alt ON restriction_list_entries(phone_number_alt);
CREATE INDEX IF NOT EXISTS idx_restriction_entries_account ON restriction_list_entries(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_restriction_entries_expires ON restriction_list_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_restriction_entries_added ON restriction_list_entries(added_at);

CREATE INDEX IF NOT EXISTS idx_restriction_keywords_list ON restriction_list_keywords(list_type);
CREATE INDEX IF NOT EXISTS idx_restriction_keywords_account ON restriction_list_keywords(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_restriction_keywords_active ON restriction_list_keywords(is_active);

CREATE INDEX IF NOT EXISTS idx_restriction_logs_entry ON restriction_list_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_restriction_logs_phone ON restriction_list_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_restriction_logs_date ON restriction_list_logs(performed_at);

CREATE INDEX IF NOT EXISTS idx_restriction_stats_date ON restriction_list_stats(date);
CREATE INDEX IF NOT EXISTS idx_restriction_stats_list ON restriction_list_stats(list_type);

-- ============================================================
-- FUNCTION: Calcular data de expiração automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_restriction_expiry()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a lista tem retention_days definido, calcular expires_at
    IF NEW.expires_at IS NULL THEN
        SELECT 
            CASE 
                WHEN retention_days IS NOT NULL 
                THEN NOW() + (retention_days || ' days')::INTERVAL
                ELSE NULL
            END INTO NEW.expires_at
        FROM restriction_list_types
        WHERE id = NEW.list_type;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular expiração ao inserir
DROP TRIGGER IF EXISTS set_restriction_expiry ON restriction_list_entries;
CREATE TRIGGER set_restriction_expiry
    BEFORE INSERT ON restriction_list_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_restriction_expiry();

-- ============================================================
-- FUNCTION: Atualizar timestamp de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_restriction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_restriction_entries_timestamp ON restriction_list_entries;
CREATE TRIGGER update_restriction_entries_timestamp
    BEFORE UPDATE ON restriction_list_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_restriction_timestamp();

DROP TRIGGER IF EXISTS update_restriction_keywords_timestamp ON restriction_list_keywords;
CREATE TRIGGER update_restriction_keywords_timestamp
    BEFORE UPDATE ON restriction_list_keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_restriction_timestamp();

-- ============================================================
-- FUNCTION: Registrar ações no log automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION log_restriction_action()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO restriction_list_logs (entry_id, list_type, action, phone_number, contact_name, details)
        VALUES (NEW.id, NEW.list_type, 'added', NEW.phone_number, NEW.contact_name, 
                jsonb_build_object('method', NEW.added_method, 'keyword', NEW.keyword_matched));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO restriction_list_logs (entry_id, list_type, action, phone_number, contact_name)
        VALUES (OLD.id, OLD.list_type, 'removed', OLD.phone_number, OLD.contact_name);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para registrar ações
DROP TRIGGER IF EXISTS log_restriction_insert ON restriction_list_entries;
CREATE TRIGGER log_restriction_insert
    AFTER INSERT ON restriction_list_entries
    FOR EACH ROW
    EXECUTE FUNCTION log_restriction_action();

DROP TRIGGER IF EXISTS log_restriction_delete ON restriction_list_entries;
CREATE TRIGGER log_restriction_delete
    AFTER DELETE ON restriction_list_entries
    FOR EACH ROW
    EXECUTE FUNCTION log_restriction_action();

-- ============================================================
-- VIEW: Entradas ativas (não expiradas)
-- ============================================================
CREATE OR REPLACE VIEW active_restriction_entries AS
SELECT 
    e.*,
    t.name as list_name,
    t.retention_days,
    CASE 
        WHEN e.expires_at IS NULL THEN 'Permanente'
        WHEN e.expires_at > NOW() THEN 'Ativo'
        ELSE 'Expirado'
    END as status,
    CASE 
        WHEN e.expires_at IS NOT NULL AND e.expires_at > NOW()
        THEN EXTRACT(DAY FROM (e.expires_at - NOW()))::INTEGER
        ELSE NULL
    END as days_until_expiry
FROM restriction_list_entries e
JOIN restriction_list_types t ON e.list_type = t.id
WHERE e.expires_at IS NULL OR e.expires_at > NOW();

-- ============================================================
-- VIEW: Estatísticas gerais por lista
-- ============================================================
CREATE OR REPLACE VIEW restriction_list_overview AS
SELECT 
    t.id as list_type,
    t.name as list_name,
    t.retention_days,
    wa.id as account_id,
    wa.name as account_name,
    COUNT(e.id) as total_entries,
    COUNT(CASE WHEN e.added_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as added_last_24h,
    COUNT(CASE WHEN e.added_at >= NOW() - INTERVAL '7 days' THEN 1 END) as added_last_7d,
    COUNT(CASE WHEN e.expires_at IS NOT NULL AND e.expires_at <= NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon
FROM restriction_list_types t
CROSS JOIN whatsapp_accounts wa
LEFT JOIN restriction_list_entries e ON 
    e.list_type = t.id 
    AND e.whatsapp_account_id = wa.id
    AND (e.expires_at IS NULL OR e.expires_at > NOW())
WHERE wa.is_active = true
GROUP BY t.id, t.name, t.retention_days, wa.id, wa.name;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================




