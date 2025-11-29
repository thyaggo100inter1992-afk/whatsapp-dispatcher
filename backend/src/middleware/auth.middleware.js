/**
 * Middleware de Autenticação Multi-Tenant
 * Verifica JWT token e injeta informações do usuário e tenant no request
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../database/connection');
const sessionService = require('../services/session.service');

// Secret para JWT (deve estar no .env)
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-forte-aqui-mude-isso';

/**
 * Middleware principal de autenticação
 * Verifica token JWT e carrega dados do usuário
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Extrair token do header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido'
      });
    }

    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    const token = parts[1];

    // 2. Verificar e decodificar token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // 3. Buscar usuário no banco
    const userResult = await pool.query(
      `SELECT 
        u.id,
        u.tenant_id,
        u.nome,
        u.email,
        u.role,
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
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
    }

    const user = userResult.rows[0];

    // 4. 🔐 VERIFICAR SE A SESSÃO AINDA É VÁLIDA
    // Se outro login foi feito, esta sessão foi invalidada
    const isSessionValid = await sessionService.isSessionValid(token, user.id);
    
    if (!isSessionValid) {
      return res.status(401).json({
        success: false,
        message: 'Sua sessão foi encerrada porque você fez login em outro dispositivo.',
        code: 'SESSION_INVALID',
        forceLogout: true // Flag para frontend fazer logout imediato
      });
    }

    // 5. Atualizar última atividade da sessão
    await sessionService.updateLastActivity(token);

    // 6. Verificar se tenant está ativo (EXCETO para super_admin e contas bloqueadas/suspensas acessando rotas permitidas)
    // Super Admin NUNCA é bloqueado pelo status do tenant
    // Contas BLOQUEADAS ou SUSPENSAS podem acessar:
    // - /gestao e /payments (para escolher/renovar plano)
    // - /logs e /permissions (funcionalidades auxiliares necessárias)
    const allowedRoutesForBlocked = ['/gestao', '/payments', '/logs', '/permissions', '/system-settings'];
    const isAllowedRoute = allowedRoutesForBlocked.some(route => req.originalUrl.includes(route));
    const isBlocked = user.tenant_status === 'blocked';
    const isSuspended = user.tenant_status === 'suspended';
    const requiresPayment = isBlocked || isSuspended;
    
    // ✅ Aceitar tanto 'active' quanto 'trial' como status válidos
    const validStatuses = ['active', 'trial'];
    const hasValidStatus = validStatuses.includes(user.tenant_status);
    
    if (user.role !== 'super_admin' && !requiresPayment && (!user.tenant_ativo || !hasValidStatus)) {
      return res.status(401).json({
        success: false,
        message: 'Sua sessão foi encerrada porque a conta foi desativada.',
        code: 'TENANT_INACTIVE',
        forceLogout: true // Flag para frontend fazer logout imediato
      });
    }

    // Se precisa pagar mas NÃO está acessando rota permitida, bloquear
    if (requiresPayment && !isAllowedRoute && user.role !== 'super_admin') {
      const message = isBlocked 
        ? 'Seu período de teste expirou. Escolha um plano para continuar.'
        : 'Seu pagamento está vencido. Renove seu plano para continuar.';
        
      return res.status(403).json({
        success: false,
        message: message,
        code: 'REQUIRES_PAYMENT',
        redirectTo: '/gestao'
      });
    }

    // 7. Injetar dados no request
    req.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      emailVerificado: user.email_verificado
    };

    req.tenant = {
      id: user.tenant_id,
      nome: user.tenant_nome,
      slug: user.tenant_slug,
      status: user.tenant_status,
      plano: user.tenant_plano
    };

    // 8. Atualizar último acesso do tenant (async, não bloqueia)
    pool.query(
      'UPDATE tenants SET data_ultimo_acesso = NOW() WHERE id = $1',
      [user.tenant_id]
    ).catch(err => console.error('Erro ao atualizar último acesso:', err));

    next();

  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar autenticação'
    });
  }
};

/**
 * Middleware opcional - não requer autenticação mas carrega dados se token presente
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // Sem token, continua sem autenticação
      return next();
    }

    // Tem token, tenta autenticar
    await authenticate(req, res, next);
  } catch (error) {
    // Se falhar, continua sem autenticação
    next();
  }
};

/**
 * Middleware para verificar permissões específicas
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permissão negada',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se é super admin
 */
const requireSuperAdmin = authorize('super_admin');

/**
 * Middleware para verificar se é admin ou super admin
 */
const requireAdmin = authorize('admin', 'super_admin');

/**
 * Gerar token JWT para usuário
 */
const generateToken = (userId, tenantId) => {
  return jwt.sign(
    { 
      userId,
      tenantId,
      type: 'access'
    },
    JWT_SECRET,
    { 
      expiresIn: '7d' // Token válido por 7 dias
    }
  );
};

/**
 * Gerar refresh token (válido por mais tempo)
 */
const generateRefreshToken = (userId, tenantId) => {
  return jwt.sign(
    { 
      userId,
      tenantId,
      type: 'refresh'
    },
    JWT_SECRET,
    { 
      expiresIn: '30d' // Refresh token válido por 30 dias
    }
  );
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireSuperAdmin,
  requireAdmin,
  generateToken,
  generateRefreshToken
};

