-- Trigger para proteger contra deleção quando fizer upgrade
-- Se o plano mudar de 'teste' para outro, limpa campos de trial

CREATE OR REPLACE FUNCTION proteger_upgrade_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o plano mudou de 'teste' para outro plano
  IF OLD.plano = 'teste' AND NEW.plano != 'teste' THEN
    -- Limpar campos de trial para evitar deleção
    NEW.trial_ends_at = NULL;
    NEW.blocked_at = NULL;
    NEW.will_be_deleted_at = NULL;
    
    -- Se estava bloqueado, desbloquear
    IF NEW.status = 'blocked' THEN
      NEW.status = 'active';
    END IF;
    
    -- Log da proteção
    RAISE NOTICE 'UPGRADE DETECTADO: Tenant % mudou de teste para %. Proteção ativada!', NEW.nome, NEW.plano;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_proteger_upgrade_trial ON tenants;
CREATE TRIGGER trigger_proteger_upgrade_trial
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION proteger_upgrade_trial();

COMMENT ON FUNCTION proteger_upgrade_trial() IS 'Protege tenant contra deleção quando faz upgrade do plano teste';



