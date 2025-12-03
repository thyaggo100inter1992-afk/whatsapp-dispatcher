-- Tabela para registrar notificações de pagamento enviadas
-- Evita enviar múltiplas notificações no mesmo dia

CREATE TABLE IF NOT EXISTS payment_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'expiration_warning', 'blocked', 'deleted_warning'
  days_before INTEGER, -- Para expiration_warning: 3, 2 ou 1
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_notifications_tenant_id ON payment_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_type ON payment_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_sent_at ON payment_notifications(sent_at);

-- RLS (Row Level Security)
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants só veem suas próprias notificações
CREATE POLICY payment_notifications_tenant_isolation ON payment_notifications
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::int);

-- Policy: Permitir inserção para o próprio tenant
CREATE POLICY payment_notifications_tenant_insert ON payment_notifications
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::int);

COMMENT ON TABLE payment_notifications IS 'Registro de notificações de pagamento enviadas por email';
COMMENT ON COLUMN payment_notifications.notification_type IS 'Tipo: expiration_warning (3,2,1 dias antes), blocked (bloqueio), deleted_warning (aviso de deleção)';
COMMENT ON COLUMN payment_notifications.days_before IS 'Dias antes do vencimento (apenas para expiration_warning)';

