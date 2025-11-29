import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { pool } from '../database/connection';

// Serviços escritos em CommonJS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionService = require('../services/session.service');

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-forte-aqui-mude-isso';

const allowedRoutesForBlocked = ['/gestao', '/payments', '/logs', '/permissions', '/system-settings'];
const validStatuses = ['active', 'trial'];

const extractToken = (authHeader?: string) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

const decodeToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload & { userId: number };
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      const err = new Error('Token expirado');
      (err as any).code = 'TOKEN_EXPIRED';
      throw err;
    }

    const err = new Error('Token inválido');
    (err as any).code = 'TOKEN_INVALID';
    throw err;
  }
};

const fetchUser = async (userId: number) => {
  const result = await pool.query(
    `SELECT 
      u.id,
      u.tenant_id,
      u.nome,
      u.email,
      u.role,
      u.permissoes,
      u.ativo,
      u.email_verificado,
      t.nome as tenant_nome,
      t.slug as tenant_slug,
      t.status as tenant_status,
      t.plano as tenant_plano,
      t.ativo as tenant_ativo
    FROM tenant_users u
    INNER JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = $1 AND u.ativo = true`,
    [userId]
  );

  return result.rows[0];
};

const updateTenantLastAccess = (tenantId: number) => {
  pool
    .query('UPDATE tenants SET data_ultimo_acesso = NOW() WHERE id = $1', [tenantId])
    .catch((err) => console.error('Erro ao atualizar último acesso:', err));
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido',
      });
      return;
    }

    const decoded = decodeToken(token);
    const user = await fetchUser(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo',
      });
      return;
    }

    const isSessionValid = await sessionService.isSessionValid(token, user.id);
    if (!isSessionValid) {
      res.status(401).json({
        success: false,
        message: 'Sua sessão foi encerrada porque você fez login em outro dispositivo.',
        code: 'SESSION_INVALID',
        forceLogout: true,
      });
      return;
    }

    await sessionService.updateLastActivity(token);

    const isAllowedRoute = allowedRoutesForBlocked.some((route) => req.originalUrl.includes(route));
    const isBlocked = user.tenant_status === 'blocked';
    const isSuspended = user.tenant_status === 'suspended';
    const requiresPayment = isBlocked || isSuspended;
    const hasValidStatus = validStatuses.includes(user.tenant_status);

    if (user.role !== 'super_admin' && !requiresPayment && (!user.tenant_ativo || !hasValidStatus)) {
      res.status(401).json({
        success: false,
        message: 'Sua sessão foi encerrada porque a conta foi desativada.',
        code: 'TENANT_INACTIVE',
        forceLogout: true,
      });
      return;
    }

    if (requiresPayment && !isAllowedRoute && user.role !== 'super_admin') {
      const message = isBlocked
        ? 'Seu período de teste expirou. Escolha um plano para continuar.'
        : 'Seu pagamento está vencido. Renove seu plano para continuar.';

      res.status(403).json({
        success: false,
        message,
        code: 'REQUIRES_PAYMENT',
        redirectTo: '/gestao',
      });
      return;
    }

    const reqAny = req as any;

    reqAny.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      emailVerificado: user.email_verificado,
      permissoes: Array.isArray(user.permissoes)
        ? (user.permissoes as string[])
        : typeof user.permissoes === 'object' && user.permissoes !== null
        ? Object.keys(user.permissoes)
        : [],
    };

    reqAny.tenant = {
      id: user.tenant_id,
      nome: user.tenant_nome,
      slug: user.tenant_slug,
      status: user.tenant_status,
      plano: user.tenant_plano,
    };

    updateTenantLastAccess(user.tenant_id);

    next();
  } catch (error: any) {
    if (error?.code === 'TOKEN_EXPIRED') {
      res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error?.code === 'TOKEN_INVALID') {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
      return;
    }

    console.error('Erro no middleware de autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar autenticação',
    });
    return;
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      return next();
    }

    await authenticate(req, res, next);
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};

