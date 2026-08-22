-- Anexos de e-mails da caixa (Inbound Parse / envio)
ALTER TABLE email_mailbox_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
