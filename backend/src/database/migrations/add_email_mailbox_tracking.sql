-- Tracking de webhook (SendGrid/Mailgun) nas mensagens da caixa — uso interno
ALTER TABLE email_mailbox_messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(30) NULL;

CREATE INDEX IF NOT EXISTS idx_email_mailbox_msgs_provider_id
  ON email_mailbox_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN email_mailbox_messages.tracking_status IS
  'Status interno de engajamento: sent, delivered, opened, clicked, replied, bounced, failed, complained — nunca enviado ao cliente';
COMMENT ON COLUMN email_mailbox_messages.opened_at IS 'Horário em que o cliente abriu (webhook) — interno';
COMMENT ON COLUMN email_mailbox_messages.clicked_at IS 'Horário em que o cliente clicou (webhook) — interno';
COMMENT ON COLUMN email_mailbox_messages.replied_at IS 'Horário em que o cliente respondeu — interno';
