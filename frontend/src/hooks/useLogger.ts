import { useCallback } from 'react';
import logger from '@/services/logger';

/**
 * Hook customizado para facilitar o uso do logger
 * 
 * Uso:
 * const { logAction, logError, logButtonClick } = useLogger();
 * 
 * logAction('criar_campanha', { nome: 'Minha Campanha' });
 * logError('Erro ao salvar', 'save_form');
 * logButtonClick('enviar', 'dashboard');
 */
export function useLogger() {
  const logAction = useCallback((action: string, data?: any, context?: string) => {
    logger.logCrudAction('create', action, undefined, { ...data, context });
  }, []);

  const logError = useCallback((error: Error | string, context?: string) => {
    logger.logError(error, context);
  }, []);

  const logButtonClick = useCallback((buttonName: string, context?: string) => {
    logger.logButtonClick(buttonName, context);
  }, []);

  const logFormSubmit = useCallback((formName: string, data?: any) => {
    logger.logFormSubmit(formName, data);
  }, []);

  const logApiRequest = useCallback((method: string, url: string, status: number, data?: any) => {
    logger.logApiRequest(method, url, status, data);
  }, []);

  return {
    logAction,
    logError,
    logButtonClick,
    logFormSubmit,
    logApiRequest
  };
}



