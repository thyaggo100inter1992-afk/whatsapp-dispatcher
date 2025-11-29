-- ================================================
-- HISTÓRICO DE VERIFICAÇÕES UAZ
-- ================================================

-- Criar tabela de histórico de verificações
CREATE TABLE IF NOT EXISTS uaz_verification_history (
  id SERIAL PRIMARY KEY,
  instance_id INTEGER NOT NULL REFERENCES uaz_instances(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  is_in_whatsapp BOOLEAN NOT NULL,
  verified_name VARCHAR(255),
  jid VARCHAR(255),
  error_message TEXT,
  verified_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_uaz_verification_history_instance 
  ON uaz_verification_history(instance_id);
  
CREATE INDEX IF NOT EXISTS idx_uaz_verification_history_phone 
  ON uaz_verification_history(phone_number);
  
CREATE INDEX IF NOT EXISTS idx_uaz_verification_history_date 
  ON uaz_verification_history(verified_at DESC);

-- Comentários
COMMENT ON TABLE uaz_verification_history IS 'Histórico de verificações de números no WhatsApp via UAZ';
COMMENT ON COLUMN uaz_verification_history.instance_id IS 'ID da instância UAZ utilizada';
COMMENT ON COLUMN uaz_verification_history.phone_number IS 'Número verificado';
COMMENT ON COLUMN uaz_verification_history.is_in_whatsapp IS 'Se o número tem WhatsApp';
COMMENT ON COLUMN uaz_verification_history.verified_name IS 'Nome verificado do WhatsApp';
COMMENT ON COLUMN uaz_verification_history.jid IS 'JID do WhatsApp';
COMMENT ON COLUMN uaz_verification_history.error_message IS 'Mensagem de erro se houver';
COMMENT ON COLUMN uaz_verification_history.verified_at IS 'Data/hora da verificação';

-- Verificar se a tabela foi criada
SELECT 'Tabela uaz_verification_history criada com sucesso!' as status;






