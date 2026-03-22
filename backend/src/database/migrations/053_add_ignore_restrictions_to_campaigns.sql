-- Adicionar coluna ignore_restrictions às tabelas de campanha
-- Permite que o usuário escolha enviar para contatos mesmo que estejam na lista de restrição

ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS ignore_restrictions BOOLEAN DEFAULT FALSE;

ALTER TABLE qr_campaigns 
  ADD COLUMN IF NOT EXISTS ignore_restrictions BOOLEAN DEFAULT FALSE;
