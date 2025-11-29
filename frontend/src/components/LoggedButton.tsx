import React from 'react';
import logger from '@/services/logger';

interface LoggedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  logName: string;
  logContext?: string;
  children: React.ReactNode;
}

/**
 * Botão que automaticamente loga cliques
 * 
 * Uso:
 * <LoggedButton 
 *   logName="enviar_campanha" 
 *   logContext="dashboard" 
 *   onClick={handleEnviar}
 * >
 *   Enviar Campanha
 * </LoggedButton>
 */
const LoggedButton: React.FC<LoggedButtonProps> = ({ 
  logName, 
  logContext, 
  onClick, 
  children, 
  ...rest 
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Log do clique
    logger.logButtonClick(logName, logContext);
    
    // Executar o onClick original se existir
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button onClick={handleClick} {...rest}>
      {children}
    </button>
  );
};

export default LoggedButton;



