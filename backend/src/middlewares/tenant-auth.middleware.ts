import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import connectionManager from '../database/tenant-connection';

// Estender Request do Express para incluir user e tenant
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        nome: string;
        email: string;
        role: string;
        permissoes: string[];
      };
      tenant?: {
        id: number;
        uuid: string;
        nome: string;
        slug: string;
        plano: string;
        status: string;
        limites: {
          campanhas_mes: number;
          contatos_total: number;
          instancias_whatsapp: number;
          usuarios: number;
          templates: number;
          storage_mb: number;
          mensagens_mes: number;
        };
        configuracoes: any;
        integracoes: any;
      };
      queryTenant?: (text: string, params?: any[]) => Promise<any>;
    }
  }
}

interface JWTPayload {
  userId: number;
  tenantId: number;
  email: string;
  role: string;
}

/**
 * Middleware de autenticação multi-tenant
 * Valida JWT, busca usuário e tenant, e adiciona no request
 */
export const tenantAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extrair token do header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Verificar JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'seu_secret_aqui_MUDE_ISSO'
    ) as JWTPayload;

    // 3. Buscar usuário e tenant no banco MASTER
    const result = await connectionManager.query(
      `SELECT 
        tu.id, tu.tenant_id, tu.nome, tu.email, tu.role, 
        tu.permissoes, tu.ativo as user_ativo,
        t.id as tenant_db_id, t.uuid as tenant_uuid, 
        t.nome as tenant_nome, t.slug as tenant_slug,
        t.status as tenant_status, t.plano, t.ativo as tenant_ativo,
        t.limite_campanhas_mes, t.limite_contatos_total, 
        t.limite_instancias_whatsapp, t.limite_usuarios,
        t.limite_templates, t.limite_storage_mb, 
        t.limite_mensagens_mes,
        t.configuracoes, t.integracoes,
        t.proximo_vencimento
      FROM tenant_users tu
      INNER JOIN tenants t ON tu.tenant_id = t.id
      WHERE tu.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    const userData = result.rows[0];

    // 4. Validações de status
    if (!userData.user_ativo) {
      res.status(403).json({ error: 'Usuário desativado' });
      return;
    }

    if (!userData.tenant_ativo) {
      res.status(403).json({
        error: 'Conta desativada. Entre em contato com o suporte.',
      });
      return;
    }

    if (userData.tenant_status === 'suspended') {
      res.status(403).json({
        error: 'Conta suspensa. Regularize seu pagamento.',
        vencimento: userData.proximo_vencimento,
      });
      return;
    }

    if (userData.tenant_status === 'cancelled') {
      res.status(403).json({ error: 'Conta cancelada.' });
      return;
    }

    // Alerta de trial expirando
    if (userData.tenant_status === 'trial') {
      const diasRestantes = Math.ceil(
        (new Date(userData.proximo_vencimento).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (diasRestantes <= 3 && diasRestantes > 0) {
        res.setHeader('X-Trial-Days-Left', diasRestantes.toString());
      }
    }

    // 5. Atualizar último acesso (async, não bloquear)
    connectionManager
      .query(
        `UPDATE tenant_users 
         SET ultimo_login = NOW(), 
             ultimo_ip = $1, 
             total_logins = total_logins + 1 
         WHERE id = $2`,
        [req.ip || req.socket.remoteAddress, userData.id]
      )
      .catch((err) => console.error('Erro ao atualizar último login:', err));

    connectionManager
      .query(
        `UPDATE tenants 
         SET data_ultimo_acesso = NOW() 
         WHERE id = $1`,
        [userData.tenant_id]
      )
      .catch((err) => console.error('Erro ao atualizar último acesso tenant:', err));

    // 6. Adicionar informações no request
    req.user = {
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      role: userData.role,
      permissoes: userData.permissoes || [],
    };

    req.tenant = {
      id: userData.tenant_id,
      uuid: userData.tenant_uuid,
      nome: userData.tenant_nome,
      slug: userData.tenant_slug,
      plano: userData.plano,
      status: userData.tenant_status,
      limites: {
        campanhas_mes: userData.limite_campanhas_mes,
        contatos_total: userData.limite_contatos_total,
        instancias_whatsapp: userData.limite_instancias_whatsapp,
        usuarios: userData.limite_usuarios,
        templates: userData.limite_templates,
        storage_mb: userData.limite_storage_mb,
        mensagens_mes: userData.limite_mensagens_mes,
      },
      configuracoes: userData.configuracoes || {},
      integracoes: userData.integracoes || {},
    };

    // 7. Helper para queries com tenant automático
    req.queryTenant = async (text: string, params?: any[]) => {
      return connectionManager.queryWithTenant(req.tenant!.id, text, params);
    };

    next();
  } catch (error: any) {
    console.error('❌ Erro no middleware de autenticação:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
      return;
    }

    res.status(500).json({ error: 'Erro ao autenticar' });
  }
};

/**
 * Middleware para verificar permissões específicas
 */
export const checkPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Admin sempre tem acesso
    if (req.user?.role === 'super_admin' || req.user?.role === 'tenant_admin') {
      next();
      return;
    }

    // Verificar se tem a permissão
    if (!req.user?.permissoes.includes(requiredPermission)) {
      res.status(403).json({
        error: 'Você não tem permissão para realizar esta ação',
        permissao_necessaria: requiredPermission,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar role mínima
 */
export const checkRole = (requiredRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(req.user?.role || '')) {
      res.status(403).json({
        error: 'Você não tem permissão para acessar este recurso',
        role_necessaria: requiredRoles,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware para super admin (ver todos os tenants)
 */
export const superAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({
      error: 'Acesso restrito a super administradores',
    });
    return;
  }

  next();
};





