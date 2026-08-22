-- Campos de ficha do cliente no envio único (para resposta inbound ao atendente)
ALTER TABLE email_marketing_single_sends
  ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS var1 TEXT,
  ADD COLUMN IF NOT EXISTS var2 TEXT,
  ADD COLUMN IF NOT EXISTS var3 TEXT,
  ADD COLUMN IF NOT EXISTS var4 TEXT,
  ADD COLUMN IF NOT EXISTS var5 TEXT,
  ADD COLUMN IF NOT EXISTS protocol VARCHAR(20);
