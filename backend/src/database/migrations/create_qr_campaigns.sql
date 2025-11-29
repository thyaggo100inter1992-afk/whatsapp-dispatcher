-- ============================================
-- TABELAS DE CAMPANHAS QR CONNECT
-- ============================================
-- Sistema de campanhas em massa para WhatsApp QR Code
-- Baseado no sistema de campanhas da API Oficial
-- ============================================

-- Tabela principal de campanhas QR Connect
CREATE TABLE IF NOT EXISTS qr_campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, running, paused, completed, cancelled
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_contacts INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  schedule_config JSONB, -- { work_start_time, work_end_time, interval_seconds }
  pause_config JSONB, -- { pause_after, pause_duration_minutes }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Templates QR Code associados à campanha
CREATE TABLE IF NOT EXISTS qr_campaign_templates (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES qr_campaigns(id) ON DELETE CASCADE,
  instance_id INT NOT NULL REFERENCES uaz_instances(id),
  qr_template_id INT NOT NULL REFERENCES qr_templates(id),
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  consecutive_failures INT DEFAULT 0,
  last_error TEXT,
  removed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contatos associados à campanha
CREATE TABLE IF NOT EXISTS qr_campaign_contacts (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES qr_campaigns(id) ON DELETE CASCADE,
  contact_id INT NOT NULL REFERENCES contacts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);

-- Mensagens enviadas pela campanha QR
CREATE TABLE IF NOT EXISTS qr_campaign_messages (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES qr_campaigns(id) ON DELETE CASCADE,
  contact_id INT REFERENCES contacts(id),
  instance_id INT REFERENCES uaz_instances(id),
  qr_template_id INT REFERENCES qr_templates(id),
  phone_number VARCHAR(20) NOT NULL,
  template_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  whatsapp_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_qr_campaigns_status ON qr_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_qr_campaigns_scheduled_at ON qr_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_templates_campaign_id ON qr_campaign_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_templates_instance_id ON qr_campaign_templates(instance_id);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_contacts_campaign_id ON qr_campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_messages_campaign_id ON qr_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_messages_status ON qr_campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_qr_campaign_messages_phone_number ON qr_campaign_messages(phone_number);

-- Comentários
COMMENT ON TABLE qr_campaigns IS 'Campanhas de envio em massa via WhatsApp QR Connect';
COMMENT ON TABLE qr_campaign_templates IS 'Templates QR Code associados às campanhas';
COMMENT ON TABLE qr_campaign_contacts IS 'Contatos associados às campanhas QR';
COMMENT ON TABLE qr_campaign_messages IS 'Mensagens enviadas pelas campanhas QR';

-- ============================================
-- PRONTO! ✅
-- ============================================
-- Execute este arquivo para criar as tabelas:
-- psql -U postgres -d whatsapp_dispatcher -f create_qr_campaigns.sql
-- ============================================








