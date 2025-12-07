import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection';

/**
 * Middleware para verificar se o tenant tem permissão para usar o Chat de Atendimento
 */
export const checkChatPermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = (req as any).tenant?.id;

    console.log('🔍 [Chat Permission] Verificando permissão para tenant:', tenantId);

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Tenant não identificado'
      });
    }

    // Buscar tenant e seu plano
    const result = await query(
      `SELECT 
        t.id,
        t.funcionalidades_customizadas,
        t.funcionalidades_config,
        p.permite_chat_atendimento
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tenant não encontrado'
      });
    }

    const tenant = result.rows[0];
    
    console.log('📊 [Chat Permission] Dados do tenant:', {
      id: tenant.id,
      funcionalidades_customizadas: tenant.funcionalidades_customizadas,
      config_chat: tenant.funcionalidades_config?.permite_chat_atendimento,
      plano_chat: tenant.permite_chat_atendimento
    });

    // Verificar se tem funcionalidades customizadas
    if (tenant.funcionalidades_customizadas && tenant.funcionalidades_config) {
      const config = tenant.funcionalidades_config;
      
      // Se está explicitamente definido nas configurações customizadas
      if (config.permite_chat_atendimento !== undefined) {
        if (config.permite_chat_atendimento === true) {
          console.log('✅ [Chat Permission] PERMITIDO por customização');
          return next(); // Permitido por customização
        } else {
          console.log('❌ [Chat Permission] NEGADO por customização');
          return res.status(403).json({
            success: false,
            error: 'Chat de Atendimento não está habilitado para sua conta',
            code: 'CHAT_DISABLED'
          });
        }
      }
    }

    // Se não tem customização, verifica o plano
    if (tenant.permite_chat_atendimento === true) {
      console.log('✅ [Chat Permission] PERMITIDO pelo plano');
      return next(); // Permitido pelo plano
    }

    // Não tem permissão
    console.log('❌ [Chat Permission] NEGADO - não tem permissão');
    return res.status(403).json({
      success: false,
      error: 'Chat de Atendimento não está disponível no seu plano atual',
      code: 'CHAT_NOT_IN_PLAN'
    });

  } catch (error: any) {
    console.error('❌ Erro ao verificar permissão de chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar permissões'
    });
  }
};

